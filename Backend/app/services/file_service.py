from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from pymongo import ReturnDocument

from app.database.mongodb import db
from app.models.file_model import COUNTERS_COLLECTION, FILE_COUNTER_KEY, FILES_COLLECTION, file_document_to_response
from app.models.medical_record import MEDICAL_RECORDS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.schemas.file_schema import FileUploadResponse
from app.schemas.file_schema import FileListResponse

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}
ALLOWED_SUFFIXES = {
    "application/pdf": {".pdf"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
}
UPLOAD_DIRECTORY = Path("uploads")


def _detected_file_type(header: bytes) -> str | None:
    """Identify the permitted file formats from their immutable file signatures."""
    if header.startswith(b"%PDF-"):
        return "application/pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def _validate_references(patient_id: str | None, medical_record_id: str | None) -> None:
    patient = None
    if patient_id:
        patient = db[PATIENTS_COLLECTION].find_one(
            {"patient_id": patient_id, "is_deleted": {"$ne": True}}
        )
        if patient is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    if medical_record_id:
        medical_record = db[MEDICAL_RECORDS_COLLECTION].find_one(
            {"record_id": medical_record_id, "is_deleted": {"$ne": True}}
        )
        if medical_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Medical record not found.",
            )
        if patient and medical_record.get("patient_id") != patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The medical record does not belong to the supplied patient.",
            )


def _next_file_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update({"_id": FILE_COUNTER_KEY}, {"$inc": {"sequence_value": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"FILE{counter['sequence_value']:06d}"


def ensure_file_indexes() -> None:
    collection = db[FILES_COLLECTION]
    collection.create_index("file_id", unique=True, name="unique_file_id")
    collection.create_index("patient_id", name="file_patient_id")
    collection.create_index("medical_record_id", name="file_medical_record_id")
    collection.create_index("uploaded_by", name="file_uploaded_by")
    collection.create_index("is_deleted", name="file_is_deleted")


async def upload_file(file: UploadFile, uploaded_by: str, patient_id: str | None, medical_record_id: str | None) -> FileUploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    header = await file.read(16)
    detected_type = _detected_file_type(header)
    await file.seek(0)
    if detected_type is None or suffix not in ALLOWED_SUFFIXES[detected_type]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, PNG, JPG, and JPEG files are allowed.")
    _validate_references(patient_id, medical_record_id)
    file_id = _next_file_id()
    stored_filename = f"{file_id}_{uuid4().hex}{ALLOWED_TYPES[detected_type]}"
    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    target = UPLOAD_DIRECTORY / stored_filename
    size = 0
    try:
        with target.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File size must not exceed 10 MB.")
                output.write(chunk)
    except Exception:
        if target.exists():
            target.unlink()
        raise
    now = datetime.now(timezone.utc)
    document = {"file_id": file_id, "patient_id": patient_id, "medical_record_id": medical_record_id, "uploaded_by": uploaded_by, "original_filename": Path(file.filename or "upload").name, "stored_filename": stored_filename, "content_type": detected_type, "file_size": size, "created_at": now, "is_deleted": False, "deleted_at": None}
    db[FILES_COLLECTION].insert_one(document)
    return file_document_to_response(document)


def get_stored_file(file_id: str) -> tuple[dict, Path]:
    document = db[FILES_COLLECTION].find_one({"file_id": file_id, "is_deleted": {"$ne": True}})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    _validate_references(document.get("patient_id"), document.get("medical_record_id"))
    file_path = UPLOAD_DIRECTORY / Path(document["stored_filename"]).name
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found.")
    return document, file_path


def soft_delete_file(file_id: str) -> None:
    document = db[FILES_COLLECTION].find_one(
        {"file_id": file_id, "is_deleted": {"$ne": True}}
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    _validate_references(document.get("patient_id"), document.get("medical_record_id"))
    db[FILES_COLLECTION].update_one(
        {"_id": document["_id"], "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )


def list_files(page: int, limit: int, search: str | None, patient_id: str | None, medical_record_id: str | None) -> FileListResponse:
    _validate_references(patient_id, medical_record_id)
    query: dict = {"is_deleted": {"$ne": True}}
    if patient_id:
        query["patient_id"] = patient_id
    if medical_record_id:
        query["medical_record_id"] = medical_record_id
    if search:
        import re
        pattern = re.escape(search.strip())
        query["$or"] = [{field: {"$regex": pattern, "$options": "i"}} for field in ("file_id", "original_filename", "content_type")]

    # Do not expose a file after a linked patient or medical record is soft deleted.
    accessible_files = [
        {"$match": query},
        {
            "$lookup": {
                "from": PATIENTS_COLLECTION,
                "let": {"patient_id": "$patient_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$eq": ["$patient_id", "$$patient_id"]},
                        {"$ne": ["$is_deleted", True]},
                    ]}}}
                ],
                "as": "linked_patient",
            }
        },
        {
            "$lookup": {
                "from": MEDICAL_RECORDS_COLLECTION,
                "let": {"record_id": "$medical_record_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$eq": ["$record_id", "$$record_id"]},
                        {"$ne": ["$is_deleted", True]},
                    ]}}}
                ],
                "as": "linked_medical_record",
            }
        },
        {
            "$match": {
                "$expr": {
                    "$and": [
                        {"$or": [
                            {"$eq": ["$patient_id", None]},
                            {"$gt": [{"$size": "$linked_patient"}, 0]},
                        ]},
                        {"$or": [
                            {"$eq": ["$medical_record_id", None]},
                            {"$gt": [{"$size": "$linked_medical_record"}, 0]},
                        ]},
                    ]
                }
            }
        },
        {"$project": {"linked_patient": 0, "linked_medical_record": 0}},
    ]
    total_row = next(iter(db[FILES_COLLECTION].aggregate(accessible_files + [{"$count": "total"}])), None)
    total = total_row["total"] if total_row else 0
    rows = list(
        db[FILES_COLLECTION].aggregate(
            accessible_files
            + [
                {"$sort": {"created_at": -1}},
                {"$skip": (page - 1) * limit},
                {"$limit": limit},
            ]
        )
    )
    pages = (total + limit - 1) // limit
    return FileListResponse(total=total, page=page, limit=limit, total_pages=pages, has_next=page < pages, has_previous=page > 1, data=[file_document_to_response(row) for row in rows])
