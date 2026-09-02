from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

# Both models were fitted on an integer severity of 1-5. Anything higher lands on
# the same terminal tree split and yields an identical, misleading prediction.
SEVERITY_MIN = 1
SEVERITY_MAX = 5


class PatientPriorityRequest(BaseModel):
    patient_id: str = Field(min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Severity: int = Field(ge=SEVERITY_MIN, le=SEVERITY_MAX)
    Gender: str = Field(min_length=1, max_length=30)
    Age: int = Field(ge=0, le=130)
    Number_of_Visits: int = Field(ge=0)
    Abnormal_Result: str = Field(min_length=1, max_length=80)
    Diagnosis: str = Field(min_length=1, max_length=120)
    Symptoms: str = Field(min_length=1, max_length=200)
    Days_Since_Last_Visit: int = Field(ge=0)


class PatientPriorityResponse(BaseModel):
    patient_id: str | None = None
    prediction: int
    probabilities: dict[str, float]
    advisory: str


class WaitTimeRequest(BaseModel):
    patient_id: str = Field(min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Gender: str = Field(min_length=1, max_length=30)
    Age: int = Field(ge=0, le=130)
    Number_of_Visits: int = Field(ge=0)
    Abnormal_Result: str = Field(min_length=1, max_length=80)
    Symptom_Count: int = Field(ge=0)
    Chronic_Condition: str = Field(min_length=1, max_length=30)
    Severity_Score: int = Field(ge=SEVERITY_MIN, le=SEVERITY_MAX)


class WaitTimeResponse(BaseModel):
    patient_id: str | None = None
    estimated_wait_time: float
    advisory: str


class AIInputSchemaResponse(BaseModel):
    """The exact input domain each model was trained on.

    Served so the UI can render real choices instead of free-text boxes whose
    values the encoder would silently discard.
    """

    patient_priority: dict[str, Any]
    wait_time: dict[str, Any]
