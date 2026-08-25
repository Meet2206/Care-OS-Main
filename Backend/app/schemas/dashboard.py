from datetime import date

from pydantic import BaseModel


class DashboardOverviewResponse(BaseModel):
    total_users: int
    total_patients: int
    total_doctors: int
    total_appointments: int
    today_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    pending_appointments: int
    total_medical_records: int
    total_prescriptions: int
    total_bills: int
    total_revenue: float
    pending_payments: float


class DailyRevenueResponse(BaseModel):
    date: date
    amount: float


class DashboardRevenueResponse(BaseModel):
    year: int
    month: int | None
    total_revenue: float
    paid: float
    pending: float
    refunded: float
    daily_revenue: list[DailyRevenueResponse]


class DashboardAppointmentResponse(BaseModel):
    scheduled: int
    completed: int
    cancelled: int
    today: int
    this_week: int
    this_month: int


class DashboardDoctorResponse(BaseModel):
    doctor_id: str
    doctor_name: str
    appointments: int
    patients: int
    revenue: float


class DashboardDepartmentResponse(BaseModel):
    department: str
    doctor_count: int
    appointment_count: int


class DashboardPatientResponse(BaseModel):
    new_today: int
    new_this_month: int
    active_patients: int


class DashboardRecentResponse(BaseModel):
    patients: list[dict]
    appointments: list[dict]
    bills: list[dict]
    medical_records: list[dict]
