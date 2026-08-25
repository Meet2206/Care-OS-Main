from typing import Any

from app.schemas.file_schema import FileUploadResponse

FILES_COLLECTION = "files"
COUNTERS_COLLECTION = "counters"
FILE_COUNTER_KEY = "file_id"


def file_document_to_response(document: dict[str, Any]) -> FileUploadResponse:
    return FileUploadResponse(**{key: value for key, value in document.items() if key not in {"_id", "is_deleted", "deleted_at"}})
