from copy import deepcopy
from datetime import datetime, timezone
import re

import pytest
from fastapi.testclient import TestClient

import main
from app.schemas.auth import UserResponse, UserRole
from app.services import doctor_service
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


class FakeDoctorsCollection:
    def __init__(self) -> None:
        self.records: list[dict] = []

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

    def insert_one(self, record: dict):
        self.records.append({**record, "_id": record["doctor_id"]})

        class Result:
            inserted_id = record["doctor_id"]

        return Result()

    def find_one(self, query: dict):
        for record in self.records:
            if self._matches(record, query):
                return deepcopy(record)
        return None

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


def current_user() -> UserResponse:
    return UserResponse(
        id="507f1f77bcf86cd799439011",
        full_name="Test Administrator",
        email="admin@example.com",
        role=UserRole.admin,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def client(monkeypatch):
    collection = FakeDoctorsCollection()
    doctor_numbers = iter([1, 2, 3])
    monkeypatch.setattr(doctor_service, "_doctors_collection", lambda: collection)
    monkeypatch.setattr(doctor_service, "ensure_doctor_indexes", lambda: None)
    monkeypatch.setattr(doctor_service, "_next_doctor_id", lambda: f"DOC{next(doctor_numbers):06d}")
    monkeypatch.setattr(main.mongodb, "connect", lambda: None)
    monkeypatch.setattr(main.mongodb, "close", lambda: None)
    monkeypatch.setattr(main, "ensure_patient_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_doctor_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_appointment_indexes", lambda: None)
    monkeypatch.setattr(main, "ensure_medical_record_indexes", lambda: None)
    app.dependency_overrides[get_current_user] = current_user

    with TestClient(app) as test_client:
        yield test_client, collection
    app.dependency_overrides.clear()


def doctor_payload(**overrides) -> dict:
    payload = {
        "first_name": "Ananya",
        "last_name": "Rao",
        "gender": "Female",
        "date_of_birth": "1985-04-12",
        "email": "ananya.rao@example.com",
        "phone": "9876543210",
        "address": "14 Lake View Road",
        "department": "Cardiology",
        "specialization": "Interventional Cardiology",
        "qualification": "MBBS, MD, DM",
        "experience_years": 12,
        "consultation_fee": 800,
        "license_number": "MED-CARD-001",
    }
    payload.update(overrides)
    return payload


def test_doctor_routes_require_authentication(client):
    test_client, _ = client
    app.dependency_overrides.clear()

    assert test_client.get("/api/v1/doctors").status_code == 401
    assert test_client.post("/api/v1/doctors", json=doctor_payload()).status_code == 401


def test_doctor_crud_search_and_soft_delete(client):
    test_client, collection = client
    created = test_client.post("/api/v1/doctors", json=doctor_payload())

    assert created.status_code == 201
    assert created.json()["doctor_id"] == "DOC000001"
    assert created.json()["date_of_birth"] == "1985-04-12"
    assert isinstance(collection.records[0]["date_of_birth"], datetime)

    searched = test_client.get("/api/v1/doctors", params={"search": "doc000", "page": 1, "limit": 10})
    assert searched.status_code == 200
    assert searched.json()["total"] == 1
    assert searched.json()["total_pages"] == 1

    updated = test_client.put("/api/v1/doctors/DOC000001", json={"availability": "Busy"})
    assert updated.status_code == 200
    assert updated.json()["availability"] == "Busy"

    assert test_client.delete("/api/v1/doctors/DOC000001").status_code == 204
    assert collection.records[0]["is_deleted"] is True
    assert test_client.get("/api/v1/doctors/DOC000001").status_code == 404


def test_duplicate_email_and_license_are_rejected(client):
    test_client, _ = client
    assert test_client.post("/api/v1/doctors", json=doctor_payload()).status_code == 201

    duplicate_email = test_client.post(
        "/api/v1/doctors",
        json=doctor_payload(license_number="MED-CARD-002"),
    )
    assert duplicate_email.status_code == 409
    assert "email" in duplicate_email.json()["detail"].lower()

    duplicate_license = test_client.post(
        "/api/v1/doctors",
        json=doctor_payload(email="other@example.com"),
    )
    assert duplicate_license.status_code == 409
    assert "license" in duplicate_license.json()["detail"].lower()


def test_doctor_validation_and_not_found(client):
    test_client, _ = client
    invalid = test_client.post("/api/v1/doctors", json=doctor_payload(consultation_fee=-1))
    assert invalid.status_code == 422
    assert test_client.get("/api/v1/doctors/DOC999999").status_code == 404
