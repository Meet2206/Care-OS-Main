from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.controllers.dashboard_controller import appointments, departments, doctors, overview, patients, recent, revenue
from app.schemas.auth import UserResponse
from app.schemas.dashboard import DashboardAppointmentResponse, DashboardDepartmentResponse, DashboardDoctorResponse, DashboardOverviewResponse, DashboardPatientResponse, DashboardRecentResponse, DashboardRevenueResponse
from app.utils.security import require_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
AdminUser = Annotated[UserResponse, Depends(require_admin)]


@router.get("/overview", response_model=DashboardOverviewResponse, summary="Get dashboard overview")
def get_dashboard_overview(_: AdminUser) -> DashboardOverviewResponse:
    return overview()


@router.get("/revenue", response_model=DashboardRevenueResponse, summary="Get revenue analytics")
def get_dashboard_revenue(_: AdminUser, year: int = Query(ge=2000, le=2100), month: int | None = Query(default=None, ge=1, le=12)) -> DashboardRevenueResponse:
    return revenue(year, month)


@router.get("/appointments", response_model=DashboardAppointmentResponse, summary="Get appointment analytics")
def get_dashboard_appointments(_: AdminUser) -> DashboardAppointmentResponse:
    return appointments()


@router.get("/doctors", response_model=list[DashboardDoctorResponse], summary="Get doctor analytics")
def get_dashboard_doctors(_: AdminUser) -> list[DashboardDoctorResponse]:
    return doctors()


@router.get("/departments", response_model=list[DashboardDepartmentResponse], summary="Get department analytics")
def get_dashboard_departments(_: AdminUser) -> list[DashboardDepartmentResponse]:
    return departments()


@router.get("/patients", response_model=DashboardPatientResponse, summary="Get patient analytics")
def get_dashboard_patients(_: AdminUser) -> DashboardPatientResponse:
    return patients()


@router.get("/recent", response_model=DashboardRecentResponse, summary="Get recent activity")
def get_dashboard_recent(_: AdminUser) -> DashboardRecentResponse:
    return recent()
