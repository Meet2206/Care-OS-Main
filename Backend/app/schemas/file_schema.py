from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FileUploadResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"file_id": "FILE000001", "patient_id": "PAT000001", "medical_record_id": "MR000001", "uploaded_by": "USR000001", "original_filename": "report.pdf", "stored_filename": "FILE000001.pdf", "content_type": "application/pdf", "file_size": 24576, "created_at": "2026-08-01T09:00:00Z"}]})
    file_id: str
    patient_id: str | None
    medical_record_id: str | None
    uploaded_by: str
    original_filename: str
    stored_filename: str
    content_type: str
    file_size: int
    created_at: datetime


class FileListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[FileUploadResponse]
