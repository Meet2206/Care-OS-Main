import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database import mongodb
from app.middleware.audit import AuditLogMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routes import ai, appointment, audit_log_routes, auth, billing, dashboard, database, doctor, file_routes, medical_record, medicine, notification, patient, pharmacy_order, prescription, report
from app.services.appointment_service import ensure_appointment_indexes
from app.services.doctor_service import ensure_doctor_indexes
from app.services.medical_record_service import ensure_medical_record_indexes
from app.services.prescription_service import ensure_prescription_indexes
from app.services.pharmacy_order_service import ensure_pharmacy_order_indexes
from app.services.billing_service import ensure_billing_indexes
from app.services.notification_service import ensure_notification_indexes
from app.services.patient_service import ensure_patient_indexes
from app.services.auth_service import ensure_demo_users, ensure_user_indexes
from app.services.file_service import ensure_file_indexes
from app.services.audit_log_service import ensure_audit_log_indexes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("care_os")


@asynccontextmanager
async def lifespan(_: FastAPI):
    mongodb.connect()
    ensure_patient_indexes()
    ensure_doctor_indexes()
    ensure_appointment_indexes()
    ensure_medical_record_indexes()
    ensure_prescription_indexes()
    ensure_pharmacy_order_indexes()
    ensure_billing_indexes()
    ensure_notification_indexes()
    ensure_user_indexes()
    ensure_file_indexes()
    ensure_audit_log_indexes()

    seeded_password = ensure_demo_users()
    if seeded_password:
        # Development only. Printed once so a local run is usable without
        # storing a password anywhere in the repository.
        logger.warning(
            "Seeded development accounts (Admin@CareOS, DoctorMeet@CareOS, "
            "PharmacyMeet@CareOS, PatientMeet@CareOS, Reception@CareOS) "
            "with password: %s",
            seeded_password,
        )
    yield
    mongodb.close()


app = FastAPI(
    title="Care-OS API",
    lifespan=lifespan,
    # Interactive documentation maps the whole attack surface, so it is served
    # only where ENABLE_API_DOCS allows it (development by default).
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

# Middleware runs in reverse registration order, so headers are applied last and
# therefore cover every response, including audited ones.
app.add_middleware(AuditLogMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Retry-After"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(patient.router, prefix="/api/v1")
app.include_router(doctor.router, prefix="/api/v1")
app.include_router(appointment.router, prefix="/api/v1")
app.include_router(medical_record.router, prefix="/api/v1")
app.include_router(prescription.router, prefix="/api/v1")
app.include_router(medicine.router, prefix="/api/v1")
app.include_router(pharmacy_order.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(report.router, prefix="/api/v1")
app.include_router(notification.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(database.router, prefix="/api/v1")
app.include_router(file_routes.router, prefix="/api/v1")
app.include_router(audit_log_routes.router, prefix="/api/v1")


@app.get("/health", tags=["Health"], summary="Liveness probe")
async def health_check() -> dict[str, str]:
    """Report that the process is running. Does not touch dependencies."""
    return {"status": "healthy"}


@app.get("/ready", tags=["Health"], summary="Readiness probe")
async def readiness_check():
    """Report whether the dependencies needed to serve traffic are reachable."""
    from fastapi.responses import JSONResponse
    from starlette.concurrency import run_in_threadpool

    def _probe_database() -> bool:
        try:
            mongodb.ping()
            return True
        except Exception:
            logger.exception("Readiness probe failed to reach MongoDB")
            return False

    database_ready = await run_in_threadpool(_probe_database)
    payload = {
        "status": "ready" if database_ready else "degraded",
        "database": "up" if database_ready else "down",
    }
    return JSONResponse(payload, status_code=200 if database_ready else 503)
