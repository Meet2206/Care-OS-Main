from typing import Any

from app.schemas.doctor import DoctorResponse

DOCTORS_COLLECTION = "doctors"
COUNTERS_COLLECTION = "counters"
DOCTOR_COUNTER_KEY = "doctor_id"


def doctor_document_to_response(doctor: dict[str, Any]) -> DoctorResponse:
    """Convert a MongoDB doctor document into its public API representation."""
    doctor_data = {key: value for key, value in doctor.items() if key not in {"_id", "is_deleted", "deleted_at"}}
    return DoctorResponse(**doctor_data)
