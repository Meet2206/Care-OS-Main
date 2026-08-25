from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.controllers.file_controller import upload
from app.controllers.file_controller import get_file
from app.controllers.file_controller import delete_file
from app.controllers.file_controller import list_all
from app.schemas.auth import AUTH_ERROR_RESPONSES, UserResponse
from app.schemas.file_schema import FileListResponse, FileUploadResponse
from app.utils.security import require_admin, require_roles

router = APIRouter(prefix="/files", tags=["Files"])
FileReadUser = Annotated[
    UserResponse,
    Depends(require_roles("admin", "receptionist")),
]
AdminUser = Annotated[UserResponse, Depends(require_admin)]


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED, summary="Upload a patient or medical-record file", responses=AUTH_ERROR_RESPONSES)
async def upload_file(
    _: FileReadUser,
    file: UploadFile = File(..., description="PDF, PNG, JPG, or JPEG file up to 10 MB"),
    patient_id: str | None = Form(default=None),
    medical_record_id: str | None = Form(default=None),
) -> FileUploadResponse:
    return await upload(file, _.user_id or _.id, patient_id, medical_record_id)


@router.get("", response_model=FileListResponse, responses=AUTH_ERROR_RESPONSES)
def list_uploaded_files(_: FileReadUser, page: int = 1, limit: int = 10, search: str | None = None, patient_id: str | None = None, medical_record_id: str | None = None) -> FileListResponse:
    return list_all(page, limit, search, patient_id, medical_record_id)


@router.get("/{file_id}", response_class=FileResponse, summary="Download an uploaded file", responses=AUTH_ERROR_RESPONSES)
def get_uploaded_file(file_id: str, _: FileReadUser) -> FileResponse:
    document, file_path = get_file(file_id)
    return FileResponse(file_path, media_type=document["content_type"], filename=document["original_filename"])


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, responses=AUTH_ERROR_RESPONSES)
def delete_uploaded_file(file_id: str, _: AdminUser) -> Response:
    delete_file(file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
