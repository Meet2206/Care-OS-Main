from app.schemas.dashboard import DashboardAppointmentResponse, DashboardDepartmentResponse, DashboardDoctorResponse, DashboardOverviewResponse, DashboardPatientResponse, DashboardRecentResponse, DashboardRevenueResponse
from app.services.dashboard_service import get_appointment_analytics, get_department_analytics, get_doctor_analytics, get_overview, get_patient_analytics, get_recent_activity, get_revenue


def overview() -> DashboardOverviewResponse:
    return get_overview()


def revenue(year: int, month: int | None) -> DashboardRevenueResponse:
    return get_revenue(year, month)


def appointments() -> DashboardAppointmentResponse:
    return get_appointment_analytics()


def doctors() -> list[DashboardDoctorResponse]:
    return get_doctor_analytics()


def departments() -> list[DashboardDepartmentResponse]:
    return get_department_analytics()


def patients() -> DashboardPatientResponse:
    return get_patient_analytics()


def recent() -> DashboardRecentResponse:
    return get_recent_activity()
