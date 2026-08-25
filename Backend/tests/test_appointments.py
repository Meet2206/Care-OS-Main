from copy import deepcopy
from datetime import datetime, timezone
import re

import pytest
from fastapi.testclient import TestClient

import main
from app.models.doctor import DOCTORS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.schemas.auth import UserResponse, UserRole
from app.services import appointment_service
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

    def create_index(self, *args, **kwargs) -> str:
        return kwargs.get("name", "index")

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
        self.records.append({**record, "_id": record["appointment_id"]})

        class Result:
            inserted_id = record["appointment_id"]

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
        self.patient_records = [{"patient_id": "PAT000001", "is_deleted": False}]
        self.doctor_records = [{"doctor_id": "DOC000001", "is_deleted": False}]

    def __getitem__(self, collection_name: str) -> FakeCollection:
        if collection_name == PATIENTS_COLLECTION:
            return FakeCollection(self.patient_records)
        if collection_name == DOCTORS_COLLECTION:
            return FakeCollection(self.doctor_records)
        raise KeyError(collection_name)


def authenticated_user() -> UserResponse:
    return UserResponse(
        id="507f1f77bcf86cd799439011",
        full_name="Test Administrator",
        email="admin@example.com",
        role=UserRole.admin,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def client(monkeypatch):
    appointments = FakeCollection()
    references = FakeDatabase()
    appointment_numbers = iter([1, 2, 3])
    monkeypatch.setattr(appointment_service, "_appointments_collection", lambda: appointments)
    monkeypatch.setattr(appointment_service, "ensure_appointment_indexes", lambda: None)
    monkeypatch.setattr(
        appointment_service,
        "_next_appointment_id",
        lambda: f"APT{next(appointment_numbers):06d}",
    )
    monkeypatch.setattr(appointment_service, "db", references)
    monkeypatch.setattr(main.mongodb, "connect", lambda: None)
    monkeypatch.setattr(main.mongodb, "close", lambda: None)
    monkeypatch.setattr(main, "ensure_patient_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_doctor_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_appointment_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_medical_record_indexes", lambda: None)
    app.dependency_overrides[get_current_user] = authenticated_user

    with TestClient(app) as test_client:
        yield test_client, appointments, references
    app.dependency_overrides.clear()


def appointment_payload(**overrides) -> dict:
    payload = {
        "patient_id": "PAT000001",
        "doctor_id": "DOC000001",
        "appointment_date": "2026-08-05",
        "appointment_time": "10:30:00",
        "appointment_type": "General Consultation",
        "reason": "Recurring chest discomfort",
    }
    payload.update(overrides)
    return payload


def test_appointment_routes_require_authentication(client):
    test_client, _, _ = client
    app.dependency_overrides.clear()

    assert test_client.get("/api/v1/appointments").status_code == 401
    assert test_client.post("/api/v1/appointments", json=appointment_payload()).status_code == 401


def test_create_filter_update_and_soft_delete_appointment(client):
    test_client, appointments, _ = client
    created = test_client.post("/api/v1/appointments", json=appointment_payload())

    assert created.status_code == 201
    assert created.json()["appointment_id"] == "APT000001"
    assert created.json()["appointment_date"] == "2026-08-05"
    assert isinstance(appointments.records[0]["appointment_date"], datetime)
    assert appointments.records[0]["appointment_time"] == "10:30:00"

    listed = test_client.get(
        "/api/v1/appointments",
        params={"search": "apt000", "doctor_id": "DOC000001", "status": "Scheduled"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["total_pages"] == 1

    updated = test_client.put("/api/v1/appointments/APT000001", json={"notes": "Bring prior reports"})
    assert updated.status_code == 200
    assert updated.json()["notes"] == "Bring prior reports"

    assert test_client.delete("/api/v1/appointments/APT000001").status_code == 204
    assert appointments.records[0]["is_deleted"] is True
    assert test_client.get("/api/v1/appointments/APT000001").status_code == 404


def test_conflicting_doctor_slot_is_rejected(client):
    test_client, _, _ = client
    assert test_client.post("/api/v1/appointments", json=appointment_payload()).status_code == 201

    conflict = test_client.post(
        "/api/v1/appointments",
        json=appointment_payload(reason="Follow-up consultation"),
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Doctor already has an appointment at this time."


def test_updating_to_a_conflicting_doctor_slot_is_rejected(client):
    test_client, _, _ = client
    assert test_client.post("/api/v1/appointments", json=appointment_payload()).status_code == 201
    second = test_client.post(
        "/api/v1/appointments",
        json=appointment_payload(appointment_time="11:30:00", reason="Follow-up consultation"),
    )
    assert second.status_code == 201

    conflict = test_client.put(
        f"/api/v1/appointments/{second.json()['appointment_id']}",
        json={"appointment_time": "10:30:00"},
    )
    assert conflict.status_code == 409


def test_missing_relationships_and_validation_return_errors(client):
    test_client, _, references = client
    references.patient_records.clear()
    assert test_client.post("/api/v1/appointments", json=appointment_payload()).status_code == 404

    invalid = test_client.post("/api/v1/appointments", json=appointment_payload(reason="x" * 501))
    assert invalid.status_code == 422
