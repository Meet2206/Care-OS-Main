from __future__ import annotations

import html
import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

from app.config.settings import settings

logger = logging.getLogger(__name__)
HOSPITAL_ADDRESS = "6th Floor, New Building, Near L Block, Care HOS"


def _safe(value: object, fallback: str = "—") -> str:
    return html.escape(str(value if value not in (None, "") else fallback))


def _send_html_email(recipient: str, subject: str, title: str, body_html: str, body_text: str) -> bool:
    if not all((settings.SMTP_HOST, settings.SMTP_USERNAME, settings.SMTP_PASSWORD, settings.SMTP_FROM)):
        logger.warning("Email not sent: SMTP is not configured")
        return False
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message.set_content(body_text)
    message.add_alternative(
        f"""<!doctype html><html><head><meta charset=\"utf-8\"><title>{_safe(title)}</title></head>
        <body style=\"margin:0;background:#eef3f7;font-family:Arial,Helvetica,sans-serif;color:#1f2d3d\">
        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:24px 0;background:#eef3f7\"><tr><td align=\"center\">
        <table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden\">
        <tr><td style=\"background:#0b7a75;padding:28px 32px;text-align:center;color:#fff\"><div style=\"font-size:26px;font-weight:bold\">✚ Care OS</div><div style=\"font-size:13px;color:#d6f3f1;margin-top:4px\">AI Hospital Management System</div></td></tr>
        <tr><td style=\"padding:32px\">{body_html}</td></tr>
        <tr><td style=\"background:#0b3c49;padding:22px 32px;text-align:center;color:#cfe3e8;font-size:13px\">careosaihms@gmail.com · +91 77665 54492<br><span style=\"font-size:11px;color:#8fb0b8\">© {datetime.now(timezone.utc).year} Care OS. Automated message.</span></td></tr>
        </table></td></tr></table></body></html>""",
        subtype="html",
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception:
        logger.exception("Email delivery failed", extra={"recipient": recipient, "subject": subject})
        return False
    return True


def _login_url() -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/login"


def send_patient_credentials(patient: dict, login_id: str, temporary_password: str) -> str:
    """Send the welcome and separate login-details emails after registration."""
    if not login_id or not temporary_password:
        return "account_not_created"
    recipient = str(patient["email"])
    name = _safe(patient.get("full_name"))
    login_url = _login_url()
    welcome_sent = _send_html_email(
        recipient,
        "Welcome to Care OS",
        "Welcome to Care OS",
        f"<h1 style=\"color:#0b3c49\">Welcome aboard, {name}! 👋</h1><p>Thank you for registering with Care OS. Your health profile has been created successfully.</p><p>Use your account to book appointments, access reports and prescriptions, and receive digital receipts.</p><p style=\"text-align:center;margin-top:28px\"><a href=\"{html.escape(login_url)}\" style=\"background:#0b7a75;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold\">Go to My Account</a></p><p style=\"color:#7a8896;font-size:13px;text-align:center\">Your login details will arrive in a separate email.</p>",
        f"Welcome to Care OS, {patient.get('full_name')}. Sign in at {login_url}.",
    )
    login_sent = _send_html_email(
        recipient,
        "Your Care OS login details",
        "Your Care OS login details",
        f"<h1 style=\"color:#0b3c49\">Hello {name}, your account is ready 🔐</h1><p>Use these credentials to sign in for the first time:</p><div style=\"padding:20px;background:#f6f9fb;border:1px dashed #0e9aa7;border-radius:10px;font-family:monospace\"><b>User ID</b><br><span style=\"font-size:18px\">{_safe(login_id)}</span><br><br><b>Temporary Password</b><br><span style=\"font-size:18px\">{_safe(temporary_password)}</span></div><p style=\"text-align:center;margin-top:28px\"><a href=\"{html.escape(login_url)}\" style=\"background:#0b7a75;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold\">Sign In &amp; Set New Password</a></p><p style=\"background:#fff8e6;padding:14px;border-left:4px solid #f0a500\">You must change this temporary password after signing in. Never share it.</p>",
        f"Care OS login. User ID: {login_id}. Temporary password: {temporary_password}. Sign in at {login_url} and change it immediately.",
    )
    if welcome_sent and login_sent:
        return "sent"
    if welcome_sent or login_sent:
        return "partial"
    return "failed"


def send_booking_receipt(appointment: dict, payment: dict, patient: dict, doctor: dict) -> str:
    """Send the appointment confirmation and payment receipt after payment succeeds."""
    doctor_name = f"Dr. {doctor.get('first_name', '')} {doctor.get('last_name', '')}".strip()
    appointment_date = appointment.get("appointment_date")
    if hasattr(appointment_date, "strftime"):
        appointment_date = appointment_date.strftime("%d %b %Y")
    appointment_time = str(appointment.get("appointment_time", "—"))[:5]
    total = float(payment.get("total_amount") or 0)
    advance = float(payment.get("advance_amount") or payment.get("paid_amount") or 0)
    remaining = float(payment.get("remaining_amount") or 0)
    recipient = str(patient["email"])
    body = f"""
    <h1 style=\"color:#0b3c49\">Hi {_safe(patient.get('full_name'))}, your slot is confirmed! ✅</h1>
    <p>Your appointment and advance payment have been recorded successfully.</p>
    <div style=\"background:#0b3c49;color:#fff;padding:16px;border-radius:10px;text-align:center\"><small>BOOKING ID</small><br><b style=\"font-size:22px\">{_safe(appointment.get('appointment_id'))}</b><br><small>Payment ID: {_safe(payment.get('payment_id'))}</small></div>
    <h3 style=\"color:#0b3c49;border-bottom:2px solid #0e9aa7;padding-bottom:6px\">Appointment Details</h3>
    <table width=\"100%\" cellpadding=\"6\" style=\"font-size:14px\"><tr><td>Patient</td><td><b>{_safe(patient.get('full_name'))} ({_safe(patient.get('patient_id'))})</b></td></tr><tr><td>Doctor</td><td><b>{_safe(doctor_name)}</b></td></tr><tr><td>Department</td><td><b>{_safe(doctor.get('department'))}</b></td></tr><tr><td>Date</td><td><b>{_safe(appointment_date)}</b></td></tr><tr><td>Time</td><td><b>{_safe(appointment_time)}</b></td></tr><tr><td>Location</td><td><b>{_safe(doctor.get('address') or HOSPITAL_ADDRESS)}</b></td></tr><tr><td>Doctor Cabin</td><td><b>{_safe(doctor.get('cabin'))}</b></td></tr><tr><td>Mode</td><td><b>In-person consultation</b></td></tr></table>
    <h3 style=\"color:#0b3c49;border-bottom:2px solid #0e9aa7;padding-bottom:6px\">Payment Receipt</h3>
    <table width=\"100%\" cellpadding=\"7\" style=\"font-size:14px\"><tr><td>Consultation Fee</td><td align=\"right\">₹ {total:,.2f}</td></tr><tr><td>Advance Paid</td><td align=\"right\">₹ {advance:,.2f}</td></tr><tr><td>Balance Due</td><td align=\"right\">₹ {remaining:,.2f}</td></tr><tr><td>Payment Mode</td><td align=\"right\">{_safe(payment.get('payment_method'))}</td></tr><tr><td>Transaction ID</td><td align=\"right\">{_safe(payment.get('transaction_reference'))}</td></tr><tr><td>Payment Status</td><td align=\"right\"><b>{_safe(payment.get('payment_status'))}</b></td></tr></table>
    <p style=\"background:#f2fbfa;padding:14px;border-radius:8px\"><b>Before your visit:</b><br>Arrive 15 minutes early, bring a photo ID and previous reports, and show this receipt at reception.</p>
    """
    text_body = f"Appointment {appointment.get('appointment_id')} confirmed for {appointment_date} at {appointment_time}. Doctor: {doctor_name}, {doctor.get('cabin')}. Address: {doctor.get('address') or HOSPITAL_ADDRESS}. Advance paid: ₹{advance:,.2f}; balance: ₹{remaining:,.2f}."
    return "sent" if _send_html_email(recipient, "Appointment confirmed and payment receipt", "Appointment receipt", body, text_body) else "failed"
