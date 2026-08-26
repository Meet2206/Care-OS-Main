from __future__ import annotations
from app.database.mongodb import db
from datetime import date, datetime, time, timezone

from app.schemas.report import DoctorReport, PatientHistoryReport, RevenueReport
from app.schemas.report import AppointmentListReport, PatientRegistrationReport


ACTIVE = {"is_deleted": {"$ne": True}}


def _public(document: dict) -> dict:
    return {key: value for key, value in document.items() if key != "_id"}


def _records(collection: str, patient_id: str) -> list[dict]:
    return [
        _public(record)
        for record in db[collection].find({**ACTIVE, "patient_id": patient_id}).sort("created_at", -1)
    ]


def get_patient_history(patient_id: str) -> PatientHistoryReport:
    patient = db["patients"].find_one({**ACTIVE, "patient_id": patient_id})
    if patient is None:
        raise LookupError("Patient not found.")
    return PatientHistoryReport(
        patient=_public(patient),
        appointments=_records("appointments", patient_id),
        medical_records=_records("medical_records", patient_id),
        prescriptions=_records("prescriptions", patient_id),
        bills=_records("bills", patient_id),
    )


def get_doctor_report(doctor_id: str) -> DoctorReport:
    doctor = db["doctors"].find_one({**ACTIVE, "doctor_id": doctor_id})
    if doctor is None:
        raise LookupError("Doctor not found.")
    statistics = list(
        db["appointments"].aggregate(
            [
                {"$match": {**ACTIVE, "doctor_id": doctor_id}},
                {
                    "$group": {
                        "_id": None,
                        "appointments": {"$sum": 1},
                        "patients": {"$addToSet": "$patient_id"},
                    }
                },
                {"$project": {"_id": 0, "appointments": 1, "patients": {"$size": "$patients"}}},
            ]
        )
    )
    revenue = list(
        db["bills"].aggregate(
            [
                {"$match": {**ACTIVE, "doctor_id": doctor_id, "payment_status": "Paid"}},
                {"$group": {"_id": None, "revenue": {"$sum": "$total_amount"}}},
            ]
        )
    )
    values = statistics[0] if statistics else {"appointments": 0, "patients": 0}
    return DoctorReport(
        doctor=_public(doctor),
        statistics={
            "appointments": values["appointments"],
            "patients": values["patients"],
            "revenue": float(revenue[0]["revenue"]) if revenue else 0.0,
        },
        appointment_history=[
            _public(row)
            for row in db["appointments"].find({**ACTIVE, "doctor_id": doctor_id}).sort("created_at", -1)
        ],
    )


def get_revenue_report(start_date: date, end_date: date) -> RevenueReport:
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    match = {**ACTIVE, "billing_date": {"$gte": start, "$lte": end}}
    summary_rows = list(
        db["bills"].aggregate(
            [
                {"$match": {**match, "payment_status": "Paid"}},
                {"$group": {"_id": "$payment_status", "amount": {"$sum": "$total_amount"}}},
            ]
        )
    )
    amounts = {row["_id"]: float(row["amount"]) for row in summary_rows}
    daily = list(
        db["bills"].aggregate(
            [
                {"$match": match},
                {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$billing_date"}}, "amount": {"$sum": "$total_amount"}}},
                {"$sort": {"_id": 1}},
            ]
        )
    )
    return RevenueReport(
        total_revenue=round(amounts.get("Paid", 0), 2),
        paid=round(amounts.get("Paid", 0), 2),
        pending=round(amounts.get("Pending", 0), 2),
        refunded=round(amounts.get("Refunded", 0), 2),
        daily_breakdown=[{"date": row["_id"], "amount": float(row["amount"])} for row in daily],
    )


def get_appointment_report(start_date: date | None, end_date: date | None, status: str | None, search: str | None, page: int, limit: int) -> AppointmentListReport:
    query: dict = dict(ACTIVE)
    if start_date or end_date:
        query["appointment_date"] = {}
        if start_date:
            query["appointment_date"]["$gte"] = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        if end_date:
            query["appointment_date"]["$lte"] = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    if status:
        query["status"] = status
    if search:
        import re
        pattern = re.escape(search)
        query["$or"] = [{field: {"$regex": pattern, "$options": "i"}} for field in ("appointment_id", "patient_id", "doctor_id", "reason")]
    total = db["appointments"].count_documents(query)
    rows = db["appointments"].find(query).sort("appointment_date", -1).skip((page - 1) * limit).limit(limit)
    pages = (total + limit - 1) // limit
    return AppointmentListReport(total=total, page=page, limit=limit, total_pages=pages, has_next=page < pages, has_previous=page > 1, data=[_public(row) for row in rows])


def get_patient_registration_report(start_date: date | None, end_date: date | None) -> PatientRegistrationReport:
    query: dict = dict(ACTIVE)
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        if end_date:
            query["created_at"]["$lte"] = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    patients = [_public(row) for row in db["patients"].find(query).sort("created_at", -1)]
    return PatientRegistrationReport(total=len(patients), patients=patients)
