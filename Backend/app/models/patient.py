from typing import Any

from app.schemas.patient import PatientResponse

PATIENTS_COLLECTION = "patients"
COUNTERS_COLLECTION = "counters"
PATIENT_COUNTER_KEY = "patient_id"


def patient_document_to_response(patient: dict[str, Any]) -> PatientResponse:
    """Convert a MongoDB patient document to its public API representation."""
    patient_data = {key: value for key, value in patient.items() if key != "_id"}
    return PatientResponse(**patient_data)
