"""Small, intentional application bootstrap data.

The application must not depend on patient, appointment, or clinical demo
records. The only records created at startup are the hospital's directory
doctors, which are needed so staff can begin registering real patients.
"""

from datetime import datetime, timezone

from app.database.mongodb import db
from app.services.auth_service import ensure_user_indexes, hash_password
from app.services.auth_service import _next_user_id


_HOSPITAL_DOCTORS = [
    ("DOC000101", "Aditi", "Menon", "Female", "1981-06-18", "aditi.menon@carecentral.example", "9000001101", "Cardiology", "Interventional Cardiology", "MBBS, MD, DM", 16, 1200, "CARE-CARD-101"),
    ("DOC000102", "Vikram", "Shah", "Male", "1978-11-02", "vikram.shah@carecentral.example", "9000001102", "Neurology", "Neurology", "MBBS, MD, DM", 19, 1300, "CARE-NEUR-102"),
    ("DOC000103", "Nisha", "Iyer", "Female", "1986-03-27", "nisha.iyer@carecentral.example", "9000001103", "Pediatrics", "Pediatrics", "MBBS, MD (Pediatrics)", 12, 900, "CARE-PEDS-103"),
    ("DOC000104", "Rohan", "Kapoor", "Male", "1983-09-14", "rohan.kapoor@carecentral.example", "9000001104", "Orthopedics", "Joint Replacement and Sports Medicine", "MBBS, MS (Orthopedics)", 14, 1100, "CARE-ORTH-104"),
    ("DOC000105", "Farah", "Khan", "Female", "1988-01-09", "farah.khan@carecentral.example", "9000001105", "Obstetrics & Gynaecology", "Obstetrics and Gynaecology", "MBBS, MS (OBGYN)", 10, 1000, "CARE-OBGY-105"),
    ("DOC000106", "Arjun", "Reddy", "Male", "1980-12-22", "arjun.reddy@carecentral.example", "9000001106", "General Medicine", "Internal Medicine", "MBBS, MD (Medicine)", 17, 850, "CARE-MED-106"),
    ("DOC000107", "Meera", "Deshpande", "Female", "1985-05-30", "meera.deshpande@carecentral.example", "9000001107", "Dermatology", "Dermatology and Aesthetic Medicine", "MBBS, MD (Dermatology)", 11, 950, "CARE-DERM-107"),
]


def clear_seeded_content() -> None:
    """Remove records created by the retired demo seed, if they exist."""
    for collection, field, prefix in [
        ("patients", "patient_id", "PATDEMO"),
        ("appointments", "appointment_id", "APTDEMO"),
        ("medical_records", "record_id", "MRDEMO"),
        ("prescriptions", "prescription_id", "PRDEMO"),
        ("pharmacy_orders", "order_id", "PHDEMO"),
        ("bills", "bill_id", "BILLDEMO"),
        ("notifications", "notification_id", "NTFDEMO"),
    ]:
        db[collection].delete_many({field: {"$regex": f"^{prefix}"}})
    db.doctors.delete_many({"$or": [{"doctor_id": "DOCDEMO001"}, {"license_number": "CAREOS-DEMO-DOC-001"}]})


def ensure_hospital_doctors() -> None:
    """Ensure the empty directory starts with the hospital's specialties."""
    now = datetime.now(timezone.utc)
    for doctor_id, first_name, last_name, gender, dob, email, phone, department, specialization, qualification, experience, fee, license_number in _HOSPITAL_DOCTORS:
        db.doctors.update_one(
            {"doctor_id": doctor_id},
            {"$setOnInsert": {
                "doctor_id": doctor_id,
                "first_name": first_name,
                "last_name": last_name,
                "gender": gender,
                "date_of_birth": datetime.fromisoformat(dob).replace(tzinfo=timezone.utc),
                "email": email,
                "phone": phone,
                "address": "CARE Central Multispeciality Hospital",
                "department": department,
                "specialization": specialization,
                "qualification": qualification,
                "experience_years": experience,
                "consultation_fee": fee,
                "license_number": license_number,
                "availability": "Available",
                "status": "Active",
                "is_deleted": False,
                "deleted_at": None,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )


def ensure_hospital_doctor_accounts(password: str | None) -> list[str]:
    """Create development logins linked to each seeded hospital doctor."""
    if not password:
        return []
    ensure_user_indexes()
    created_logins = []
    now = datetime.now(timezone.utc)
    for doctor in db.doctors.find({"doctor_id": {"$regex": r"^DOC00010[1-7]$"}, "is_deleted": {"$ne": True}}):
        login_id = f"{doctor['first_name']}.{doctor['last_name']}@CareOS"
        if db.users.find_one({"login_id": login_id}):
            continue
        full_name = f"Dr. {doctor['first_name']} {doctor['last_name']}"
        db.users.insert_one({
            "login_id": login_id,
            "email": doctor.get("email"),
            "full_name": full_name,
            "first_name": doctor["first_name"],
            "last_name": doctor["last_name"],
            "user_id": _next_user_id(),
            "password_hash": hash_password(password),
            "role": "doctor",
            "doctor_id": doctor["doctor_id"],
            "created_at": now,
            "updated_at": now,
            "status": "Active",
            "must_change_password": False,
            "is_deleted": False,
            "deleted_at": None,
        })
        created_logins.append(login_id)
    return created_logins
