from __future__ import annotations
from fastapi import UploadFile

from app.schemas.file_schema import FileUploadResponse
from app.services.file_service import upload_file
from app.services.file_service import get_stored_file
from app.services.file_service import soft_delete_file
from app.services.file_service import list_files


async def upload(file: UploadFile, uploaded_by: str, patient_id: str | None, medical_record_id: str | None) -> FileUploadResponse:
    return await upload_file(file, uploaded_by, patient_id, medical_record_id)


def get_file(file_id: str):
    return get_stored_file(file_id)


def delete_file(file_id: str) -> None:
    soft_delete_file(file_id)


def list_all(
    page: int,
    limit: int,
    search: str | None,
    patient_id: str | None,
    medical_record_id: str | None,
    allowed_patient_ids: set[str] | None = None,
):
    return list_files(
        page, limit, search, patient_id, medical_record_id, allowed_patient_ids=allowed_patient_ids
    )
