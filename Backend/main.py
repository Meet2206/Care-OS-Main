from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database import mongodb
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
    ensure_demo_users()
    ensure_file_indexes()
    ensure_audit_log_indexes()
    yield
    mongodb.close()


app = FastAPI(title="Care-OS API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
