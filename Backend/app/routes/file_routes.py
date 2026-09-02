from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.controllers.file_controller import delete_file, get_file, list_all, upload
from app.schemas.auth import AUTH_ERROR_RESPONSES, UserResponse, UserRole
from app.schemas.file_schema import FileListResponse, FileUploadResponse
from app.utils.security import (
    doctor_patient_ids,
    require_admin,
    require_doctor_patient_access,
    require_patient_ownership,
    require_roles,
)

router = APIRouter(prefix="/files", tags=["Files"])
# Clinicians need their patients' scans and reports; patients need their own.
# Ownership is enforced per file below rather than by role alone.
FileUser = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.patient)),
]
FileUploader = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)),
]
AdminUser = Annotated[UserResponse, Depends(require_admin)]


def _authorize_file(current_user: UserResponse, patient_id: str | None) -> None:
    if current_user.role in (UserRole.admin, UserRole.receptionist):
        return
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This file is not linked to a patient record.",
        )
    require_patient_ownership(current_user, patient_id)
    require_doctor_patient_access(current_user, patient_id)


@router.post(
    "/upload",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a patient or medical-record file",
    responses=AUTH_ERROR_RESPONSES,
)
async def upload_file(
    current_user: FileUploader,
    file: UploadFile = File(..., description="PDF, PNG, JPG, or JPEG file up to 10 MB"),
    patient_id: str | None = Form(default=None),
    medical_record_id: str | None = Form(default=None),
) -> FileUploadResponse:
    if current_user.role == UserRole.doctor and patient_id:
        require_doctor_patient_access(current_user, patient_id)
    return await upload(file, current_user.user_id or current_user.id, patient_id, medical_record_id)


@router.get("", response_model=FileListResponse, responses=AUTH_ERROR_RESPONSES)
def list_uploaded_files(
    current_user: FileUser,
    page: int = 1,
    limit: int = 10,
    search: str | None = None,
    patient_id: str | None = None,
    medical_record_id: str | None = None,
) -> FileListResponse:
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            return FileListResponse(
                total=0, page=page, limit=limit, total_pages=0,
                has_next=False, has_previous=False, data=[],
            )
        patient_id = current_user.patient_id
    elif current_user.role == UserRole.doctor:
        allowed = doctor_patient_ids(current_user.doctor_id)
        if patient_id and patient_id not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctors may access only patients they are assigned to.",
            )
        return list_all(page, limit, search, patient_id, medical_record_id, allowed_patient_ids=allowed)
    return list_all(page, limit, search, patient_id, medical_record_id)


@router.get(
    "/{file_id}",
    response_class=FileResponse,
    summary="Download an uploaded file",
    responses=AUTH_ERROR_RESPONSES,
)
def get_uploaded_file(file_id: str, current_user: FileUser) -> FileResponse:
    document, file_path = get_file(file_id)
    _authorize_file(current_user, document.get("patient_id"))
    return FileResponse(
        file_path,
        media_type=document["content_type"],
        filename=document["original_filename"],
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, responses=AUTH_ERROR_RESPONSES)
def delete_uploaded_file(file_id: str, _: AdminUser) -> Response:
    delete_file(file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
