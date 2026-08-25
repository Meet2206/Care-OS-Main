from typing import Any

from app.schemas.appointment import AppointmentResponse

APPOINTMENTS_COLLECTION = "appointments"
COUNTERS_COLLECTION = "counters"
APPOINTMENT_COUNTER_KEY = "appointment_id"


def appointment_document_to_response(appointment: dict[str, Any]) -> AppointmentResponse:
    """Convert a MongoDB appointment document into its public API representation."""
    appointment_data = {
        key: value
        for key, value in appointment.items()
        if key not in {"_id", "is_deleted", "deleted_at"}
    }
    return AppointmentResponse(**appointment_data)
