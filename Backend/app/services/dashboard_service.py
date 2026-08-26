from __future__ import annotations
from datetime import datetime, timedelta, timezone

from app.database.mongodb import db
from app.schemas.dashboard import DashboardAppointmentResponse, DashboardDepartmentResponse, DashboardDoctorResponse, DashboardOverviewResponse, DashboardPatientResponse, DashboardRecentResponse, DashboardRevenueResponse


ACTIVE = {"is_deleted": {"$ne": True}}


def _count(collection: str, filters: dict | None = None) -> int:
    return db[collection].count_documents({**ACTIVE, **(filters or {})})


def _sum_bills(payment_status: str) -> float:
    result = list(
        db["bills"].aggregate(
            [
                {"$match": {**ACTIVE, "payment_status": payment_status}},
                {"$group": {"_id": None, "amount": {"$sum": "$total_amount"}}},
            ]
        )
    )
    return round(float(result[0]["amount"]), 2) if result else 0.0


def get_overview() -> DashboardOverviewResponse:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return DashboardOverviewResponse(
        total_users=_count("users"),
        total_patients=_count("patients"),
        total_doctors=_count("doctors"),
        total_appointments=_count("appointments"),
        today_appointments=_count(
            "appointments",
            {"appointment_date": {"$gte": today, "$lt": today + timedelta(days=1)}},
        ),
        completed_appointments=_count("appointments", {"status": "Completed"}),
        cancelled_appointments=_count("appointments", {"status": "Cancelled"}),
        pending_appointments=_count("appointments", {"status": "Scheduled"}),
        total_medical_records=_count("medical_records"),
        total_prescriptions=_count("prescriptions"),
        total_bills=_count("bills"),
        total_revenue=_sum_bills("Paid"),
        pending_payments=_sum_bills("Pending"),
    )


def get_revenue(year: int, month: int | None) -> DashboardRevenueResponse:
    start = datetime(year, month or 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month in (None, 12) else datetime(year, month + 1, 1, tzinfo=timezone.utc)
    match = {**ACTIVE, "billing_date": {"$gte": start, "$lt": end}}
    totals = list(db["bills"].aggregate([{"$match": match}, {"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}, "paid": {"$sum": {"$cond": [{"$eq": ["$payment_status", "Paid"]}, "$total_amount", 0]}}, "pending": {"$sum": {"$cond": [{"$eq": ["$payment_status", "Pending"]}, "$total_amount", 0]}}, "refunded": {"$sum": {"$cond": [{"$eq": ["$payment_status", "Refunded"]}, "$total_amount", 0]}}}}]))
    summary = totals[0] if totals else {}
    daily = list(db["bills"].aggregate([{"$match": {**match, "payment_status": "Paid"}}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$billing_date"}}, "amount": {"$sum": "$total_amount"}}}, {"$sort": {"_id": 1}}]))
    paid = float(summary.get("paid", 0))
    return DashboardRevenueResponse(year=year, month=month, total_revenue=paid, paid=paid, pending=float(summary.get("pending", 0)), refunded=float(summary.get("refunded", 0)), daily_revenue=[{"date": item["_id"], "amount": float(item["amount"])} for item in daily])


def get_appointment_analytics() -> DashboardAppointmentResponse:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    return DashboardAppointmentResponse(
        scheduled=_count("appointments", {"status": "Scheduled"}),
        completed=_count("appointments", {"status": "Completed"}),
        cancelled=_count("appointments", {"status": "Cancelled"}),
        today=_count(
            "appointments",
            {"appointment_date": {"$gte": today, "$lt": today + timedelta(days=1)}},
        ),
        this_week=_count("appointments", {"appointment_date": {"$gte": week_start}}),
        this_month=_count("appointments", {"appointment_date": {"$gte": month_start}}),
    )


def get_doctor_analytics() -> list[DashboardDoctorResponse]:
    rows = list(db["doctors"].aggregate([
        {"$match": ACTIVE},
        {"$lookup": {"from": "appointments", "let": {"doctor": "$doctor_id"}, "pipeline": [{"$match": {"$expr": {"$and": [{"$eq": ["$doctor_id", "$$doctor"]}, {"$ne": ["$is_deleted", True]}]}}}], "as": "appointments"}},
        {"$lookup": {"from": "bills", "let": {"doctor": "$doctor_id"}, "pipeline": [{"$match": {"$expr": {"$and": [{"$eq": ["$doctor_id", "$$doctor"]}, {"$ne": ["$is_deleted", True]}]}, "payment_status": "Paid"}}, {"$group": {"_id": None, "amount": {"$sum": "$total_amount"}}}], "as": "billing"}},
        {"$project": {"_id": 0, "doctor_id": 1, "doctor_name": {"$trim": {"input": {"$concat": [{"$ifNull": ["$first_name", ""]}, " ", {"$ifNull": ["$last_name", ""]}]}}}, "appointments": {"$size": "$appointments"}, "patients": {"$size": {"$setUnion": [[], "$appointments.patient_id"]}}, "revenue": {"$ifNull": [{"$arrayElemAt": ["$billing.amount", 0]}, 0]}}},
        {"$sort": {"appointments": -1, "doctor_id": 1}},
    ]))
    return [DashboardDoctorResponse(**row) for row in rows]


def get_department_analytics() -> list[DashboardDepartmentResponse]:
    rows = list(db["doctors"].aggregate([
        {"$match": ACTIVE},
        {"$group": {"_id": "$department", "doctor_count": {"$sum": 1}, "doctor_ids": {"$push": "$doctor_id"}}},
        {"$lookup": {"from": "appointments", "let": {"ids": "$doctor_ids"}, "pipeline": [{"$match": {"$expr": {"$and": [{"$in": ["$doctor_id", "$$ids"]}, {"$ne": ["$is_deleted", True]}]}}}, {"$count": "count"}], "as": "appointments"}},
        {"$project": {"_id": 0, "department": "$_id", "doctor_count": 1, "appointment_count": {"$ifNull": [{"$arrayElemAt": ["$appointments.count", 0]}, 0]}}},
        {"$sort": {"department": 1}},
    ]))
    return [DashboardDepartmentResponse(**row) for row in rows]


def get_patient_analytics() -> DashboardPatientResponse:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today.replace(day=1)
    return DashboardPatientResponse(
        new_today=_count(
            "patients",
            {"created_at": {"$gte": today, "$lt": today + timedelta(days=1)}},
        ),
        new_this_month=_count("patients", {"created_at": {"$gte": month_start}}),
        active_patients=_count("patients", {"status": "Active"}),
    )


def get_recent_activity() -> DashboardRecentResponse:
    def latest(collection: str) -> list[dict]:
        records = db[collection].find(ACTIVE).sort("created_at", -1).limit(10)
        return [
            {key: str(value) if key == "_id" else value for key, value in record.items() if key != "_id"}
            for record in records
        ]

    return DashboardRecentResponse(
        patients=latest("patients"),
        appointments=latest("appointments"),
        bills=latest("bills"),
        medical_records=latest("medical_records"),
    )
