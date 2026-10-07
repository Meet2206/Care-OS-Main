import pytest

import main


@pytest.fixture(autouse=True)
def isolate_application_lifespan_from_external_database(monkeypatch):
    """Unit/API tests replace service collections with fakes.

    Keep the application lifespan from contacting a real MongoDB instance;
    runtime Mongo verification is performed separately against the local stack.
    """
    for name in (
        "ensure_patient_indexes", "ensure_doctor_indexes", "ensure_appointment_indexes",
        "ensure_medical_record_indexes", "ensure_prescription_indexes", "ensure_pharmacy_order_indexes",
        "ensure_billing_indexes", "ensure_notification_indexes", "ensure_user_indexes",
        "ensure_file_indexes", "ensure_audit_log_indexes", "ensure_advance_payment_indexes",
        "clear_seeded_content", "ensure_demo_users", "ensure_hospital_doctors", "ensure_hospital_doctor_accounts",
    ):
        if hasattr(main, name):
            monkeypatch.setattr(main, name, lambda *args, **kwargs: None)
