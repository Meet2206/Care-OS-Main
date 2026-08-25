from typing import Any

from app.schemas.prescription import PrescriptionResponse

PRESCRIPTIONS_COLLECTION = "prescriptions"
COUNTERS_COLLECTION = "counters"
PRESCRIPTION_COUNTER_KEY = "prescription_id"


def prescription_document_to_response(prescription: dict[str, Any]) -> PrescriptionResponse:
    """Convert a MongoDB prescription document into its public API format."""
    prescription_data = {
        key: value
        for key, value in prescription.items()
        if key not in {"_id", "is_deleted", "deleted_at"}
    }
    return PrescriptionResponse(**prescription_data)
