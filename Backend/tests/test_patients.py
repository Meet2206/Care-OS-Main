from copy import deepcopy
from datetime import datetime, timezone
import re

import pytest
from fastapi.testclient import TestClient

from app.schemas.auth import UserResponse, UserRole
from app.services import patient_service
from app.utils.security import get_current_user
import main

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


class FakePatientsCollection:
    def __init__(self) -> None:
        self.records: list[dict] = []

    def create_index(self, *args, **kwargs) -> str:
        return kwargs.get("name", "index")

    def insert_one(self, record: dict):
        if any(item["patient_id"] == record["patient_id"] for item in self.records):
            from pymongo.errors import DuplicateKeyError

            raise DuplicateKeyError("duplicate patient id")
        stored = {**record, "_id": record["patient_id"]}
        self.records.append(stored)

        class Result:
            inserted_id = stored["_id"]

        return Result()

    def find_one(self, query: dict):
        for record in self.records:
            if self._matches(record, query):
                return deepcopy(record)
        return None

    def _matches(self, record: dict, query: dict) -> bool:
        for key, value in query.items():
            if key == "$or":
                for condition in value:
                    field, pattern_definition = next(iter(condition.items()))
                    if re.search(pattern_definition["$regex"], record[field], re.IGNORECASE):
                        break
                else:
                    return False
            elif isinstance(value, dict) and "$ne" in value:
                if record.get(key) == value["$ne"]:
                    return False
            elif record.get(key) != value:
                return False
        return True

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

    def delete_one(self, query: dict):
        for index, record in enumerate(self.records):
            if self._matches(record, query):
                self.records.pop(index)

                class Result:
                    deleted_count = 1

                return Result()

        class Result:
            deleted_count = 0

        return Result()

def make_user(role: UserRole) -> UserResponse:
    return UserResponse(
        id="507f1f77bcf86cd799439011",
        full_name="Test Staff",
        email="staff@example.com",
        role=role,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def client(monkeypatch):
    collection = FakePatientsCollection()
    patient_numbers = iter([1, 2, 3, 4])
    monkeypatch.setattr(patient_service, "_patients_collection", lambda: collection)
    monkeypatch.setattr(patient_service, "ensure_patient_indexes", lambda: None)
    monkeypatch.setattr(patient_service, "_next_patient_id", lambda: f"PAT{next(patient_numbers):06d}")
    monkeypatch.setattr(main.mongodb, "connect", lambda: None)
    monkeypatch.setattr(main.mongodb, "close", lambda: None)
    monkeypatch.setattr(main, "ensure_patient_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_doctor_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_appointment_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_medical_record_indexes", lambda: None)

    with TestClient(app) as test_client:
        yield test_client, collection
    app.dependency_overrides.clear()


@pytest.fixture
def receptionist_client(client):
    test_client, collection = client
    app.dependency_overrides[get_current_user] = lambda: make_user(UserRole.receptionist)
    return test_client, collection


def patient_payload(**overrides) -> dict:
    payload = {
        "full_name": "Priya Nair",
        "gender": "Female",
        "date_of_birth": "1994-08-21",
        "phone": "9876543210",
        "email": "priya@example.com",
        "address": "12 Main Street",
        "blood_group": "O+",
        "emergency_contact_name": "Arun Nair",
        "emergency_contact_phone": "9876500000",
        "allergies": ["Penicillin"],
        "medical_history": ["Asthma"],
    }
    payload.update(overrides)
    return payload


def test_all_patient_routes_require_authentication(client):
    test_client, _ = client

    assert test_client.get("/api/v1/patients").status_code == 401
    assert test_client.post("/api/v1/patients", json=patient_payload()).status_code == 401
    assert test_client.get("/api/v1/patients/PAT000001").status_code == 401
    assert test_client.put("/api/v1/patients/PAT000001", json={"full_name": "New Name"}).status_code == 401
    assert test_client.delete("/api/v1/patients/PAT000001").status_code == 401


def test_receptionist_can_create_read_update_and_search_patients(receptionist_client):
    test_client, collection = receptionist_client
    created = test_client.post("/api/v1/patients", json=patient_payload())

    assert created.status_code == 201
    assert created.json()["patient_id"] == "PAT000001"
    assert created.json()["status"] == "Active"
    assert created.json()["date_of_birth"] == "1994-08-21"
    assert isinstance(collection.records[0]["date_of_birth"], datetime)

    listed = test_client.get("/api/v1/patients", params={"page": 1, "limit": 10, "search": "priya"})
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["total_pages"] == 1
    assert listed.json()["has_next"] is False
    assert listed.json()["has_previous"] is False
    assert listed.json()["data"][0]["patient_id"] == "PAT000001"

    patient_id_search = test_client.get(
        "/api/v1/patients",
        params={"page": 1, "limit": 10, "search": "pat000"},
    )
    assert patient_id_search.status_code == 200
    assert patient_id_search.json()["total"] == 1

    retrieved = test_client.get("/api/v1/patients/PAT000001")
    assert retrieved.status_code == 200

    updated = test_client.put("/api/v1/patients/PAT000001", json={"address": "99 New Street"})
    assert updated.status_code == 200
    assert updated.json()["address"] == "99 New Street"


def test_receptionist_cannot_delete_patient(receptionist_client):
    test_client, _ = receptionist_client

    assert test_client.delete("/api/v1/patients/PAT000001").status_code == 403


def test_admin_can_delete_patient(client):
    test_client, collection = client
    app.dependency_overrides[get_current_user] = lambda: make_user(UserRole.admin)
    created = test_client.post("/api/v1/patients", json=patient_payload())

    deleted = test_client.delete(f"/api/v1/patients/{created.json()['patient_id']}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert collection.records[0]["is_deleted"] is True
    assert collection.records[0]["deleted_at"] is not None
    assert test_client.get(f"/api/v1/patients/{created.json()['patient_id']}").status_code == 404


def test_duplicate_patient_id_returns_conflict(receptionist_client):
    test_client, _ = receptionist_client
    first = test_client.post("/api/v1/patients", json=patient_payload())
    assert first.status_code == 201

    patient_service._next_patient_id = lambda: "PAT000001"
    duplicate = test_client.post("/api/v1/patients", json=patient_payload(email="other@example.com"))
    assert duplicate.status_code == 409


def test_missing_patient_and_invalid_payload_return_expected_statuses(receptionist_client):
    test_client, _ = receptionist_client

    assert test_client.get("/api/v1/patients/PAT999999").status_code == 404
    invalid = test_client.post("/api/v1/patients", json=patient_payload(phone="phone-number"))
    assert invalid.status_code == 422
