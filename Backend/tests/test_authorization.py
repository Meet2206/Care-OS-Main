"""Regression tests for the authorization defects found in the system audit.

Each test names the hole it closes. They run against the real router stack with
only the identity dependency overridden, so a route-level guard that is removed
or weakened fails here rather than in production.
"""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import main
from app.schemas.auth import UserResponse, UserRole
from app.utils.security import get_current_user

app = main.app

_LINKS = {
    UserRole.doctor: {"doctor_id": "DOC000001"},
    UserRole.patient: {"patient_id": "PAT000001"},
}


def user(role: UserRole, **overrides) -> UserResponse:
    payload = {
        "id": "507f1f77bcf86cd799439011",
        "full_name": f"Test {role.value.title()}",
        "login_id": f"{role.value}@example.com",
        "role": role,
        "created_at": datetime.now(timezone.utc),
        "user_id": "USR000001",
        **_LINKS.get(role, {}),
    }
    payload.update(overrides)
    return UserResponse(**payload)


@pytest.fixture
def client(monkeypatch):
    for name in (
        "ensure_patient_indexes", "ensure_doctor_indexes", "ensure_appointment_indexes",
        "ensure_medical_record_indexes", "ensure_prescription_indexes",
        "ensure_pharmacy_order_indexes", "ensure_billing_indexes",
        "ensure_notification_indexes", "ensure_user_indexes", "ensure_file_indexes",
        "ensure_audit_log_indexes",
    ):
        monkeypatch.setattr(main, name, lambda: None)
    monkeypatch.setattr(main, "ensure_demo_users", lambda: None)
    monkeypatch.setattr(main.mongodb, "connect", lambda: None)
    monkeypatch.setattr(main.mongodb, "close", lambda: None)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def as_role(role: UserRole, **overrides):
    app.dependency_overrides[get_current_user] = lambda: user(role, **overrides)


def anonymous():
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# SEC-1: anonymous privilege escalation through self-registration
# --------------------------------------------------------------------------- #

REGISTRATION = {
    "full_name": "Mallory Attacker",
    "login_id": "attacker@evil.test",
    "password": "Passw0rd123",
    "role": "admin",
}


def test_anonymous_cannot_register_an_account(client):
    anonymous()
    assert client.post("/api/v1/auth/register", json=REGISTRATION).status_code == 401


@pytest.mark.parametrize(
    "role", [UserRole.doctor, UserRole.pharmacy, UserRole.patient, UserRole.receptionist]
)
def test_non_admins_cannot_register_an_account(client, role):
    as_role(role)
    assert client.post("/api/v1/auth/register", json=REGISTRATION).status_code == 403


# --------------------------------------------------------------------------- #
# SEC-2: every authenticated role had full CRUD on the doctor directory
# --------------------------------------------------------------------------- #

DOCTOR = {
    "first_name": "Probe", "last_name": "Doctor", "gender": "Other",
    "date_of_birth": "1980-01-01", "email": "probe@example.com", "phone": "9111111111",
    "address": "x", "department": "General Medicine", "specialization": "GM",
    "qualification": "MBBS", "experience_years": 3, "consultation_fee": 100.0,
    "license_number": "PROBE-1", "availability": "Available",
}


@pytest.mark.parametrize(
    "role", [UserRole.doctor, UserRole.pharmacy, UserRole.patient, UserRole.receptionist]
)
def test_non_admins_cannot_create_a_doctor(client, role):
    as_role(role)
    assert client.post("/api/v1/doctors", json=DOCTOR).status_code == 403


@pytest.mark.parametrize(
    "role", [UserRole.doctor, UserRole.pharmacy, UserRole.patient, UserRole.receptionist]
)
def test_non_admins_cannot_delete_a_doctor(client, role):
    as_role(role)
    assert client.delete("/api/v1/doctors/DOC000001").status_code == 403


# --------------------------------------------------------------------------- #
# SEC-6: pharmacy could read, amend, and destroy appointments
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/appointments"),
        ("get", "/api/v1/appointments/APT000001"),
        ("put", "/api/v1/appointments/APT000001"),
        ("delete", "/api/v1/appointments/APT000001"),
    ],
)
def test_pharmacy_has_no_appointment_access(client, method, path):
    as_role(UserRole.pharmacy)
    call = getattr(client, method)
    response = call(path, json={}) if method in {"put", "post"} else call(path)
    assert response.status_code == 403


def test_pharmacy_cannot_read_medical_records(client):
    as_role(UserRole.pharmacy)
    assert client.get("/api/v1/medical-records").status_code == 403


# --------------------------------------------------------------------------- #
# SEC-8: patients could zero and settle their own invoices
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("role", [UserRole.patient, UserRole.doctor, UserRole.pharmacy])
def test_only_billing_staff_may_issue_a_bill(client, role):
    as_role(role)
    response = client.post("/api/v1/bills", json={
        "appointment_id": "APT000001", "medical_record_id": "MR000001",
        "prescription_id": "PR000001", "patient_id": "PAT000001",
        "doctor_id": "DOC000001", "consultation_fee": 0, "payment_status": "Paid",
    })
    assert response.status_code == 403


@pytest.mark.parametrize("role", [UserRole.patient, UserRole.doctor, UserRole.pharmacy])
def test_only_billing_staff_may_amend_a_bill(client, role):
    as_role(role)
    response = client.put("/api/v1/bills/BILL000001", json={"payment_status": "Paid"})
    assert response.status_code == 403


@pytest.mark.parametrize("role", [UserRole.patient, UserRole.receptionist, UserRole.doctor])
def test_only_administrators_may_void_a_bill(client, role):
    as_role(role)
    assert client.delete("/api/v1/bills/BILL000001").status_code == 403


# --------------------------------------------------------------------------- #
# Role boundaries that the audit confirmed should hold
# --------------------------------------------------------------------------- #

def test_pharmacy_cannot_use_careai(client):
    as_role(UserRole.pharmacy)
    assert client.get("/api/v1/ai/schema").status_code == 403


def test_pharmacy_cannot_change_clinical_records(client):
    as_role(UserRole.pharmacy)
    assert client.put("/api/v1/medical-records/MR000001", json={}).status_code == 403


@pytest.mark.parametrize(
    "role", [UserRole.doctor, UserRole.patient, UserRole.receptionist, UserRole.admin]
)
def test_only_pharmacy_may_advance_an_order(client, role):
    as_role(role)
    response = client.patch(
        "/api/v1/pharmacy-orders/PO000001/status", json={"status": "ACCEPTED"}
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [UserRole.doctor, UserRole.pharmacy, UserRole.patient])
def test_only_administrators_read_the_audit_trail(client, role):
    as_role(role)
    assert client.get("/api/v1/audit-logs").status_code == 403


@pytest.mark.parametrize("role", [UserRole.doctor, UserRole.pharmacy, UserRole.patient])
def test_only_administrators_reach_the_database_probe(client, role):
    as_role(role)
    assert client.get("/api/v1/db-test").status_code == 403


@pytest.mark.parametrize("role", [UserRole.patient, UserRole.pharmacy])
def test_only_staff_may_register_a_patient(client, role):
    as_role(role)
    assert client.post("/api/v1/patients", json={}).status_code == 403


# --------------------------------------------------------------------------- #
# SEC-14: responses must carry the hardening headers
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "header,expected",
    [
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "no-referrer"),
        ("Cache-Control", "no-store"),
    ],
)
def test_security_headers_are_present(client, header, expected):
    assert client.get("/health").headers.get(header) == expected


def test_content_security_policy_is_present(client):
    assert "frame-ancestors 'none'" in client.get("/health").headers["Content-Security-Policy"]
