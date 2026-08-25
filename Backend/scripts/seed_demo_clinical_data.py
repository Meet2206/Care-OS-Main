"""Explicit, idempotent CARE-OS development clinical data seed."""

from datetime import datetime, timezone

from pymongo import MongoClient

from app.config.settings import settings
from app.services.auth_service import ensure_user_indexes
from app.services.doctor_service import ensure_doctor_indexes
from app.services.patient_service import ensure_patient_indexes
from app.services.appointment_service import ensure_appointment_indexes
from app.services.medical_record_service import ensure_medical_record_indexes


def seed() -> dict[str, int]:
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    ensure_user_indexes(); ensure_doctor_indexes(); ensure_patient_indexes()
    ensure_appointment_indexes(); ensure_medical_record_indexes()

    now = datetime.now(timezone.utc)
    user = db.users.find_one({"login_id": "DoctorMeet@CareOS", "is_deleted": {"$ne": True}})
    if user is None:
        raise RuntimeError("DoctorMeet@CareOS must exist before clinical seeding.")

    doctor = db.doctors.find_one({"license_number": "CAREOS-DEMO-DOC-001", "is_deleted": {"$ne": True}})
    if doctor is None:
        doctor = {
            "doctor_id": "DOCDEMO001", "first_name": "Demo", "last_name": "Doctor",
            "gender": "Other", "date_of_birth": datetime(1985, 4, 12, tzinfo=timezone.utc),
            "email": "demo.doctor@careos.example.com", "phone": "9000000001",
            "address": "CARE-OS Demo Hospital", "department": "General Medicine",
            "specialization": "General Medicine", "qualification": "MBBS",
            "experience_years": 10, "consultation_fee": 500.0,
            "license_number": "CAREOS-DEMO-DOC-001", "availability": "Available",
            "status": "Active", "created_at": now, "updated_at": now,
            "is_deleted": False, "deleted_at": None,
        }
        db.doctors.insert_one(doctor)
    else:
        db.doctors.update_one({"_id": doctor["_id"]}, {"$set": {"email": "demo.doctor@careos.example.com", "updated_at": now}})
    db.users.update_one({"_id": user["_id"]}, {"$set": {"doctor_id": doctor["doctor_id"]}})

    patients = [
        ("PATDEMO001", "Aarav Demo", "Male", "1990-02-14", "demo.patient1@careos.example.com", "9000000101"),
        ("PATDEMO002", "Mira Demo", "Female", "1987-07-21", "demo.patient2@careos.example.com", "9000000102"),
        ("PATDEMO003", "Noah Demo", "Other", "2001-11-03", "demo.patient3@careos.example.com", "9000000103"),
        ("PATDEMO004", "Ira Demo", "Female", "1978-05-09", "demo.patient4@careos.example.com", "9000000104"),
        ("PATDEMO005", "Kabir Demo", "Male", "1969-09-30", "demo.patient5@careos.example.com", "9000000105"),
    ]
    for pid, name, gender, dob, email, phone in patients:
        patient_document = {
                "patient_id": pid, "full_name": name, "gender": gender,
                "date_of_birth": datetime.fromisoformat(dob).replace(tzinfo=timezone.utc),
                "phone": phone, "email": email, "address": "CARE-OS Demo Residence",
                "blood_group": "O+", "emergency_contact_name": "Demo Contact",
                "emergency_contact_phone": phone, "allergies": [],
                "medical_history": [], "status": "Active", "created_at": now,
                "updated_at": now, "is_deleted": False, "deleted_at": None,
        }
        if db.patients.find_one({"patient_id": pid}):
            db.patients.update_one({"patient_id": pid}, {"$set": {"email": email, "updated_at": now}})
        else:
            db.patients.insert_one(patient_document)
    db.users.update_one(
        {"login_id": "PatientMeet@CareOS", "is_deleted": {"$ne": True}},
        {"$set": {"patient_id": "PATDEMO001"}},
    )

    appointment_data = [
        ("APTDEMO001", "PATDEMO001", "2026-09-02", "Scheduled", "Routine check-in"),
        ("APTDEMO002", "PATDEMO001", "2026-08-10", "Completed", "Follow-up review"),
        ("APTDEMO003", "PATDEMO002", "2026-09-04", "Scheduled", "General consultation"),
        ("APTDEMO004", "PATDEMO003", "2026-08-12", "Completed", "General consultation"),
        ("APTDEMO005", "PATDEMO004", "2026-09-06", "Scheduled", "Routine check-up"),
        ("APTDEMO006", "PATDEMO005", "2026-08-15", "Completed", "Follow-up review"),
    ]
    for aid, pid, day, status, reason in appointment_data:
        appointment_document = {
                "appointment_id": aid, "patient_id": pid, "doctor_id": doctor["doctor_id"],
                "appointment_date": datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
                "appointment_time": "10:30:00",
                "appointment_type": "General Consultation" if "General" in reason else "Follow-up",
                "reason": reason, "notes": "Deterministic CARE-OS demo record.",
                "status": status, "created_at": now, "updated_at": now,
                "is_deleted": False, "deleted_at": None,
        }
        if db.appointments.find_one({"appointment_id": aid}):
            db.appointments.update_one({"appointment_id": aid}, {"$set": {"appointment_time": "10:30:00", "updated_at": now}})
        else:
            db.appointments.insert_one(appointment_document)

    records = [
        ("MRDEMO001", "APTDEMO002", "PATDEMO001", "Stable follow-up", "Headache symptoms improving."),
        ("MRDEMO002", "APTDEMO004", "PATDEMO003", "Routine assessment", "No acute concerns reported."),
        ("MRDEMO003", "APTDEMO006", "PATDEMO005", "Blood pressure review", "Continue monitoring and follow-up."),
    ]
    for rid, aid, pid, diagnosis, symptoms in records:
        db.medical_records.update_one(
            {"record_id": rid},
            {"$setOnInsert": {
                "record_id": rid, "appointment_id": aid, "patient_id": pid,
                "doctor_id": doctor["doctor_id"], "diagnosis": diagnosis,
                "symptoms": symptoms, "vital_signs": {}, "treatment": "Supportive care",
                "notes": "Deterministic CARE-OS demo record.", "follow_up_date": None,
                "created_at": now, "updated_at": now, "is_deleted": False, "deleted_at": None,
            }}, upsert=True,
        )
    counts = {name: db[name].count_documents({"is_deleted": {"$ne": True}}) for name in ("doctors", "patients", "appointments", "medical_records", "prescriptions")}
    client.close()
    return counts


if __name__ == "__main__":
    print(seed())
