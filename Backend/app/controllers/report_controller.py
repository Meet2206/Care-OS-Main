from fastapi import HTTPException, status

from datetime import date

from app.schemas.report import AppointmentListReport, DoctorReport, PatientHistoryReport, PatientRegistrationReport, RevenueReport
from app.services.report_service import get_appointment_report, get_doctor_report, get_patient_history, get_patient_registration_report, get_revenue_report


def patient_history(patient_id: str) -> PatientHistoryReport:
    try:
        return get_patient_history(patient_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def doctor(doctor_id: str) -> DoctorReport:
    try:
        return get_doctor_report(doctor_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def revenue(start_date: date, end_date: date) -> RevenueReport:
    return get_revenue_report(start_date, end_date)


def appointments(start_date, end_date, status, search, page, limit) -> AppointmentListReport:
    return get_appointment_report(start_date, end_date, status, search, page, limit)


def patients(start_date, end_date) -> PatientRegistrationReport:
    return get_patient_registration_report(start_date, end_date)
