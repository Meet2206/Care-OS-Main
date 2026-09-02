from __future__ import annotations
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.controllers.report_controller import appointments, doctor, patient_history, patients, revenue
from app.schemas.auth import UserResponse, UserRole
from app.schemas.report import AppointmentListReport, DoctorReport, PatientHistoryReport, PatientRegistrationReport, RevenueReport
from app.utils.security import require_admin, require_doctor_patient_access, require_roles

router = APIRouter(prefix="/reports", tags=["Reports"])
ReportUser = Annotated[UserResponse, Depends(require_roles(UserRole.admin, UserRole.doctor))]


@router.get("/patient-history/{patient_id}", response_model=PatientHistoryReport)
def get_patient_history(patient_id: str, current_user: ReportUser) -> PatientHistoryReport:
    # A doctor may pull a full history only for a patient they actually treat.
    require_doctor_patient_access(current_user, patient_id)
    return patient_history(patient_id)


@router.get("/doctor/{doctor_id}", response_model=DoctorReport)
def get_doctor_report(doctor_id: str, _: Annotated[UserResponse, Depends(require_admin)]) -> DoctorReport:
    return doctor(doctor_id)


@router.get("/revenue", response_model=RevenueReport)
def get_revenue_report(
    _: Annotated[UserResponse, Depends(require_admin)],
    start_date: date = Query(),
    end_date: date = Query(),
) -> RevenueReport:
    return revenue(start_date, end_date)


@router.get("/appointments", response_model=AppointmentListReport)
def get_appointment_report(
    _: Annotated[UserResponse, Depends(require_admin)],
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
) -> AppointmentListReport:
    return appointments(start_date, end_date, status, search, page, limit)


@router.get("/patients", response_model=PatientRegistrationReport)
def get_patient_registration_report(
    _: Annotated[UserResponse, Depends(require_admin)],
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> PatientRegistrationReport:
    return patients(start_date, end_date)
