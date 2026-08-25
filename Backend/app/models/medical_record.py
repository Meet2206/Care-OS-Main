from typing import Any

from app.schemas.medical_record import MedicalRecordResponse

MEDICAL_RECORDS_COLLECTION = "medical_records"
COUNTERS_COLLECTION = "counters"
MEDICAL_RECORD_COUNTER_KEY = "medical_record_id"


def medical_record_document_to_response(record: dict[str, Any]) -> MedicalRecordResponse:
    """Convert a MongoDB medical-record document into its public API format."""
    record_data = {
        key: value
        for key, value in record.items()
        if key not in {"_id", "is_deleted", "deleted_at"}
    }
    return MedicalRecordResponse(**record_data)
