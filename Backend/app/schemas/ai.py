from __future__ import annotations
from pydantic import BaseModel, Field


class PatientPriorityRequest(BaseModel):
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Severity: int = Field(ge=0, le=10)
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
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Gender: str = Field(min_length=1, max_length=30)
    Age: int = Field(ge=0, le=130)
    Number_of_Visits: int = Field(ge=0)
    Abnormal_Result: str = Field(min_length=1, max_length=80)
    Symptom_Count: int = Field(ge=0)
    Chronic_Condition: str = Field(min_length=1, max_length=30)
    Severity_Score: int = Field(ge=0, le=10)


class WaitTimeResponse(BaseModel):
    patient_id: str | None = None
    estimated_wait_time: float
    advisory: str
