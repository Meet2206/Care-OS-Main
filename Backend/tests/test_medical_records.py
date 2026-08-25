from copy import deepcopy
from datetime import datetime, timezone
import re

import pytest
from fastapi.testclient import TestClient

import main
from app.models.appointment import APPOINTMENTS_COLLECTION
from app.models.doctor import DOCTORS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.schemas.auth import UserResponse, UserRole
from app.services import medical_record_service
from app.utils.security import get_current_user

app = main.app


class FakeCursor:
    def __init__(self, records: list[dict]) -> None:
        self.records = records

    def sort(self, field: str, direction: int):
        self.records.sort(key=lambda record: record[field], reverse=direction == -1)
        return self

    def skip(self, count: int):
        self.records = self.records[count:]
        return self

    def limit(self, count: int):
        self.records = self.records[:count]
        return self

    def __iter__(self):
        return iter(deepcopy(self.records))


class FakeCollection:
    def __init__(self, records: list[dict] | None = None) -> None:
        self.records = records or []

    def _matches(self, record: dict, query: dict) -> bool:
        for key, value in query.items():
            if key == "$or":
                for condition in value:
                    field, expression = next(iter(condition.items()))
                    if re.search(expression["$regex"], record[field], re.IGNORECASE):
                        break
                else:
                    return False
            elif isinstance(value, dict) and "$ne" in value:
                if record.get(key) == value["$ne"]:
                    return False
            elif record.get(key) != value:
                return False
        return True

    def find_one(self, query: dict):
        for record in self.records:
            if self._matches(record, query):
                return deepcopy(record)
        return None

    def insert_one(self, record: dict):
        self.records.append({**record, "_id": record["record_id"]})

        class Result:
            inserted_id = record["record_id"]

        return Result()

    def count_documents(self, query: dict) -> int:
        return sum(self._matches(record, query) for record in self.records)

    def find(self, query: dict) -> FakeCursor:
        return FakeCursor([record for record in self.records if self._matches(record, query)])

    def find_one_and_update(self, query: dict, update: dict, **kwargs):
        for record in self.records:
            if self._matches(record, query):
                record.update(update["$set"])
                return deepcopy(record)
        return None


class FakeDatabase:
    def __init__(self) -> None:
        self.collections = {
            APPOINTMENTS_COLLECTION: FakeCollection([{"appointment_id": "APT000001", "is_deleted": False}]),
            PATIENTS_COLLECTION: FakeCollection([{"patient_id": "PAT000001", "is_deleted": False}]),
            DOCTORS_COLLECTION: FakeCollection([{"doctor_id": "DOC000001", "is_deleted": False}]),
        }

    def __getitem__(self, name: str) -> FakeCollection:
        return self.collections[name]


def user() -> UserResponse:
    return UserResponse(
        id="507f1f77bcf86cd799439011",
        full_name="Test Administrator",
        email="admin@example.com",
        role=UserRole.admin,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def client(monkeypatch):
    records = FakeCollection()
    references = FakeDatabase()
    record_numbers = iter([1, 2])
    monkeypatch.setattr(medical_record_service, "_records_collection", lambda: records)
    monkeypatch.setattr(medical_record_service, "ensure_medical_record_indexes", lambda: None)
    monkeypatch.setattr(medical_record_service, "_next_record_id", lambda: f"MR{next(record_numbers):06d}")
    monkeypatch.setattr(medical_record_service, "db", references)
    monkeypatch.setattr(main.mongodb, "connect", lambda: None)
    monkeypatch.setattr(main.mongodb, "close", lambda: None)
    monkeypatch.setattr(main, "ensure_patient_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_doctor_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_appointment_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_medical_record_indexes", lambda: None)
    app.dependency_overrides[get_current_user] = user
    with TestClient(app) as test_client:
        yield test_client, records, references
    app.dependency_overrides.clear()


def payload(**overrides) -> dict:
    data = {
        "appointment_id": "APT000001",
        "patient_id": "PAT000001",
        "doctor_id": "DOC000001",
        "diagnosis": "Mild hypertension",
        "symptoms": "Headache",
        "vital_signs": {"blood_pressure": "140/90", "heart_rate": 78},
        "treatment": "Lifestyle changes",
        "follow_up_date": "2026-08-19",
    }
    data.update(overrides)
    return data


def test_medical_record_routes_require_authentication(client):
    test_client, _, _ = client
    app.dependency_overrides.clear()
    assert test_client.get("/api/v1/medical-records").status_code == 401
    assert test_client.post("/api/v1/medical-records", json=payload()).status_code == 401


def test_create_search_and_soft_delete_medical_record(client):
    test_client, records, _ = client
    created = test_client.post("/api/v1/medical-records", json=payload())
    assert created.status_code == 201
    assert created.json()["record_id"] == "MR000001"
    assert created.json()["vital_signs"]["heart_rate"] == 78
    assert created.json()["follow_up_date"] == "2026-08-19"
    assert isinstance(records.records[0]["follow_up_date"], datetime)

    listed = test_client.get("/api/v1/medical-records", params={"search": "mr000"})
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    assert test_client.delete("/api/v1/medical-records/MR000001").status_code == 204
    assert records.records[0]["is_deleted"] is True
    assert test_client.get("/api/v1/medical-records/MR000001").status_code == 404


def test_record_conflict_and_missing_appointment(client):
    test_client, _, references = client
    assert test_client.post("/api/v1/medical-records", json=payload()).status_code == 201
    duplicate = test_client.post("/api/v1/medical-records", json=payload(diagnosis="Follow-up diagnosis"))
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Medical record already exists for this appointment."

    references.collections[APPOINTMENTS_COLLECTION].records.clear()
    assert test_client.post("/api/v1/medical-records", json=payload()).status_code == 404


def test_medical_record_validation(client):
    test_client, _, _ = client
    assert test_client.post("/api/v1/medical-records", json=payload(diagnosis="")).status_code == 422
