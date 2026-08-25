from pydantic import BaseModel


class PatientHistoryReport(BaseModel):
    patient: dict
    appointments: list[dict]
    medical_records: list[dict]
    prescriptions: list[dict]
    bills: list[dict]


class DoctorStatistics(BaseModel):
    appointments: int
    patients: int
    revenue: float


class DoctorReport(BaseModel):
    doctor: dict
    statistics: DoctorStatistics
    appointment_history: list[dict]


class RevenueReport(BaseModel):
    total_revenue: float
    paid: float
    pending: float
    refunded: float
    daily_breakdown: list[dict]


class AppointmentListReport(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[dict]


class PatientRegistrationReport(BaseModel):
    total: int
    patients: list[dict]
