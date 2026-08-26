import { useEffect, useState } from "react"
import { jsPDF } from "jspdf"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AppointmentStatusPanel from "../../components/modules/patients/AppointmentStatusPanel"
import AssistancePanel from "../../components/modules/patients/AssistancePanel"
import BookingCalendar from "../../components/modules/patients/BookingCalendar"
import PatientIdCard from "../../components/modules/patients/PatientIdCard"
import PrescriptionOrdersPanel from "../../components/modules/patients/PrescriptionOrdersPanel"
import upiQrCode from "../../../upi-payment-qr.png"
import { apiRequest } from "../../api/client"
import { useAuth } from "../../context/AuthContext"
import {
    appointmentUpdates,
    appointmentTimeSlots,
    careTeam,
    doctorDirectory,
    patientProfile,
    patientSupportOptions,
} from "../../data/mockData"

function formatDateDisplay(value) {
    if (!value) {
        return "DD/MM/YYYY"
    }

    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year}`
}

function paymentMethodLabel(value) {
    if (value === "upi") return "UPI"
    if (value === "credit-card") return "Credit Card"
    if (value === "debit-card") return "Debit Card"
    return "Net Banking"
}

function isExpiryValid(expiry) {
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        return false
    }

    const [monthText, yearText] = expiry.split("/")
    const month = Number(monthText)
    const year = Number(`20${yearText}`)

    if (month < 1 || month > 12) {
        return false
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    return year > currentYear || (year === currentYear && month >= currentMonth)
}

function digitsOnly(value) {
    return value.replace(/\D/g, "")
}

function formatCardNumber(value) {
    return digitsOnly(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiryInput(value) {
    const digits = digitsOnly(value).slice(0, 4)

    if (!digits) {
        return ""
    }

    // Preserve partial typing like "0" so users can naturally reach "01".
    if (digits.length === 1) {
        return digits
    }

    const monthDigits = digits.slice(0, 2)
    const month = Math.min(Math.max(Number(monthDigits || "1"), 1), 12)
    const normalizedMonth = `${month}`.padStart(2, "0")
    const yearDigits = digits.slice(2)

    return yearDigits ? `${normalizedMonth}/${yearDigits}` : normalizedMonth
}

function createBookingTicket(form) {
    return {
        bookingId: `CARE-${Date.now().toString().slice(-6)}`,
        date: formatDateDisplay(form.date),
        time: form.time,
        doctor: form.doctor,
        specialty: form.specialty,
        location: form.location,
        paymentMethod: paymentMethodLabel(form.paymentMethod),
        amount: "Rs. 300",
    }
}

function getPaymentValidationMessage(form, qrPaid = false) {
    if (!form.date || !form.doctor || !form.time) {
        return "Choose a date, doctor, and available time slot before payment."
    }

    if (form.paymentMethod === "upi") {
        if (qrPaid) {
            return ""
        }

        return form.upiId.trim() ? "" : "Enter a valid UPI ID to continue."
    }

    if (form.paymentMethod === "net-banking") {
        return form.bankName ? "" : "Select your bank to continue."
    }

    if (!form.cardName.trim()) {
        return "Enter the cardholder name."
    }

    if (digitsOnly(form.cardNumber).length !== 16) {
        return "Card number must be 16 digits."
    }

    if (!isExpiryValid(form.expiry)) {
        return "Enter a valid, non-expired card date."
    }

    if (digitsOnly(form.cvv).length !== 3) {
        return "CVV must be exactly 3 digits."
    }

    return ""
}

function PatientDashboard() {
    const { user } = useAuth()
    const [patient, setPatient] = useState(null)
    const [patientLoadError, setPatientLoadError] = useState("")
    const [appointments, setAppointments] = useState([])
    const [records, setRecords] = useState([])
    const [pharmacyOrders, setPharmacyOrders] = useState([])
    const [pharmacyOrderError, setPharmacyOrderError] = useState("")
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [selectedSupport, setSelectedSupport] = useState("")
    const [bookingTicket, setBookingTicket] = useState(null)
    const [paymentError, setPaymentError] = useState("")
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [useQrPayment, setUseQrPayment] = useState(false)
    const [bookingForm, setBookingForm] = useState({
        date: "",
        time: "",
        doctor: "",
        specialty: "",
        location: "",
        paymentMethod: "upi",
        upiId: "",
        cardName: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
        bankName: "",
    })

    useEffect(() => {
        if (!user?.patient_id) {
            setPatientLoadError("This account is not linked to a patient profile yet.")
            return
        }
        Promise.all([
            apiRequest(`/patients/${user.patient_id}`),
            apiRequest("/appointments?limit=100"),
            apiRequest("/medical-records?limit=100"),
            apiRequest("/pharmacy-orders"),
        ]).then(([profile, appointmentResult, recordResult, orderResult]) => {
            setPatient(profile)
            setAppointments(appointmentResult.data.map((item) => ({
                ...item,
                date: item.appointment_date,
                time: item.appointment_time,
                doctor: item.doctor_id,
                specialty: item.appointment_type,
                location: "Care-OS Clinic",
            })))
            setRecords(recordResult.data.map((item) => ({
                ...item,
                id: item.record_id,
                date: item.follow_up_date || item.created_at,
                type: "Medical record",
                doctorFull: item.doctor_id,
                summary: item.diagnosis || item.treatment || "Clinical record",
            })))
            setPharmacyOrders(orderResult.data)
        }).catch((error) => {
            setPatientLoadError(error.message || "Unable to load your patient profile.")
            setPharmacyOrderError(error.message || "Unable to load pharmacy orders.")
        })
    }, [user?.patient_id])

    const patientProfileData = patient ? {
        id: patient.patient_id,
        insurance: patient.status || "Active",
        phone: patient.phone || "Not provided",
        bloodGroup: patient.blood_group || "Not provided",
        assistance: "Contact reception for assistance",
    } : patientProfile

    const handleBookingChange = (key, value) => {
        setBookingForm((current) => ({
            ...current,
            [key]: value,
        }))
        setPaymentError("")
    }

    const handleDoctorCardSelect = (doctor) => {
        setBookingForm((current) => ({
            ...current,
            doctor: doctor.name,
            specialty: doctor.specialty,
            location: doctor.location,
        }))
    }

    const handleBookingSubmit = (event) => {
        event.preventDefault()
        const paymentValidationMessage = getPaymentValidationMessage(bookingForm, useQrPayment)

        if (paymentValidationMessage) {
            setPaymentError(paymentValidationMessage)
            return
        }

        const ticket = createBookingTicket(bookingForm)

        setAppointments((current) => [
            {
                date: bookingForm.date ? formatDateDisplay(bookingForm.date) : "Pending date",
                time: bookingForm.time || "Pending time",
                doctor: bookingForm.doctor || "CareOS Scheduling Desk",
                specialty: bookingForm.specialty || "General Medicine",
                location: bookingForm.location || "Main Clinic",
                status: "Advance Paid",
            },
            ...current,
        ])

        setBookingForm({
            date: "",
            time: "",
            doctor: "",
            specialty: "",
            location: "",
            paymentMethod: "upi",
            upiId: "",
            cardName: "",
            cardNumber: "",
            expiry: "",
            cvv: "",
            bankName: "",
        })
        setShowBookingModal(false)
        setBookingTicket(ticket)
        setUseQrPayment(false)
        setPaymentError("")
    }

    const paymentValidationMessage = getPaymentValidationMessage(bookingForm, useQrPayment)

    const downloadTicket = () => {
        if (!bookingTicket) {
            return
        }

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "a4",
        })

        const pageWidth = pdf.internal.pageSize.getWidth()
        const margin = 36
        const cardWidth = pageWidth - margin * 2
        const halfWidth = (cardWidth - 12) / 2

        pdf.setFillColor(244, 239, 231)
        pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F")

        pdf.setFillColor(252, 246, 238)
        pdf.setDrawColor(216, 206, 193)
        pdf.roundedRect(margin, 36, cardWidth, 500, 22, 22, "FD")

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(10)
        pdf.setTextColor(110, 116, 111)
        pdf.text("BOOKING TICKET", margin + 24, 62)

        pdf.setFont("times", "bold")
        pdf.setFontSize(24)
        pdf.setTextColor(45, 50, 56)
        pdf.text("Appointment Confirmed", margin + 24, 92)

        pdf.setFillColor(247, 242, 235)
        pdf.roundedRect(margin + 20, 118, cardWidth - 40, 96, 18, 18, "F")

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9)
        pdf.setTextColor(110, 116, 111)
        pdf.text("BOOKING ID", margin + 40, 142)

        pdf.setFont("times", "bold")
        pdf.setFontSize(22)
        pdf.setTextColor(45, 50, 56)
        pdf.text(bookingTicket.bookingId, margin + 40, 172)

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(11)
        pdf.setTextColor(110, 116, 111)
        pdf.text("Your appointment request is confirmed and the advance payment has been recorded successfully.", margin + 40, 196)

        const infoCards = [
            ["DATE", bookingTicket.date, ""],
            ["TIME", bookingTicket.time, ""],
            ["DOCTOR", bookingTicket.doctor, bookingTicket.specialty],
            ["LOCATION", bookingTicket.location, ""],
        ]

        infoCards.forEach((card, index) => {
            const col = index % 2
            const row = Math.floor(index / 2)
            const x = margin + 20 + col * (halfWidth + 12)
            const y = 236 + row * 92

            pdf.setFillColor(245, 241, 235)
            pdf.roundedRect(x, y, halfWidth, 78, 16, 16, "F")
            pdf.setFont("helvetica", "bold")
            pdf.setFontSize(9)
            pdf.setTextColor(110, 116, 111)
            pdf.text(card[0], x + 16, y + 18)

            pdf.setFont("helvetica", "bold")
            pdf.setFontSize(13)
            pdf.setTextColor(45, 50, 56)
            pdf.text(card[1], x + 16, y + 40)

            if (card[2]) {
                pdf.setFont("helvetica", "normal")
                pdf.setFontSize(11)
                pdf.setTextColor(110, 116, 111)
                pdf.text(card[2], x + 16, y + 58)
            }
        })

        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(216, 206, 193)
        pdf.roundedRect(margin + 20, 426, cardWidth - 40, 82, 18, 18, "FD")
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(12)
        pdf.setTextColor(45, 50, 56)
        pdf.text("Payment Receipt", margin + 38, 452)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(11)
        pdf.setTextColor(110, 116, 111)
        pdf.text(`Method: ${bookingTicket.paymentMethod}`, margin + 38, 476)
        pdf.text(`Advance Paid: ${bookingTicket.amount}`, margin + 38, 496)

        pdf.save(`${bookingTicket.bookingId}.pdf`)
    }

    return (
        <>
            <div className="space-y-6">
                <PageIntro
                    eyebrow="Patient Portal"
                    title="My Health Portal"
                    description="Appointments, records, and care contacts are grouped into simple panels so patients always know what happens next."
                    actions={<Button variant="subtle" onClick={() => setShowBookingModal(true)}>Book Appointment</Button>}
                />

                {patientLoadError ? <div className="rounded-2xl border border-[#f0c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{patientLoadError}</div> : null}
                <PatientIdCard profile={patientProfileData} />

                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <AppointmentStatusPanel updates={appointmentUpdates} />
                    <AssistancePanel
                        options={patientSupportOptions}
                        selectedOption={selectedSupport}
                        onSelect={setSelectedSupport}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
                    <Card className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="font-display text-3xl text-[var(--ink)]">My Upcoming Appointments</h2>
                            <Button variant="subtle" onClick={() => setShowBookingModal(true)}>New Booking</Button>
                        </div>
                        <div className="responsive-table scroll-table mt-5 rounded-[24px] border border-[var(--line)]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--panel-muted)] text-[var(--muted)]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Date</th>
                                        <th className="px-4 py-3 font-semibold">Time</th>
                                        <th className="px-4 py-3 font-semibold">Doctor</th>
                                        <th className="px-4 py-3 font-semibold">Specialty</th>
                                        <th className="px-4 py-3 font-semibold">Location</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((appointment) => (
                                        <tr key={`${appointment.date}-${appointment.time}-${appointment.doctor}`} className="border-t border-[var(--line)] text-[var(--ink)]">
                                            <td data-label="Date" className="px-4 py-4">{appointment.date}</td>
                                            <td data-label="Time" className="px-4 py-4">{appointment.time}</td>
                                            <td data-label="Doctor" className="px-4 py-4">{appointment.doctor}</td>
                                            <td data-label="Specialty" className="px-4 py-4 text-[var(--muted)]">{appointment.specialty}</td>
                                            <td data-label="Location" className="px-4 py-4 text-[var(--muted)]">{appointment.location}</td>
                                            <td data-label="Status" className="px-4 py-4">
                                                <StatusPill tone={appointment.status === "Scheduled" ? "green" : appointment.status === "Requested" ? "blue" : "amber"}>
                                                    {appointment.status}
                                                </StatusPill>
                                            </td>
                                            <td data-label="Action" className="px-4 py-4">
                                                <Button variant="subtle" className="px-4 py-2" onClick={() => setSelectedAppointment(appointment)}>
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Care Team</h2>
                        <div className="mt-5 space-y-4">
                            {careTeam.map((member, index) => (
                                <div key={member.name} className="flex items-center gap-4 rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c7def5_0%,#d8efd5_100%)] text-lg font-semibold text-[var(--ink)]">
                                        {member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[var(--ink)]">{member.name}</p>
                                        <p className="text-sm text-[var(--muted)]">{member.role}</p>
                                    </div>
                                    {index === 0 ? <StatusPill tone="blue">Primary</StatusPill> : null}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Recent Medical Records</h2>
                        <div className="responsive-table scroll-table mt-5 rounded-[24px] border border-[var(--line)]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--panel-muted)] text-[var(--muted)]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Date</th>
                                        <th className="px-4 py-3 font-semibold">Record Type</th>
                                        <th className="px-4 py-3 font-semibold">Doctor</th>
                                        <th className="px-4 py-3 font-semibold">Summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr key={record.id} className="border-t border-[var(--line)] text-[var(--ink)]">
                                            <td data-label="Date" className="px-4 py-4">{record.date}</td>
                                            <td data-label="Record Type" className="px-4 py-4">{record.type}</td>
                                            <td data-label="Doctor" className="px-4 py-4">{record.doctorFull}</td>
                                            <td data-label="Summary" className="px-4 py-4 text-[var(--muted)]">{record.summary}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {pharmacyOrderError ? <div className="rounded-2xl border border-[#f0c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{pharmacyOrderError}</div> : <PrescriptionOrdersPanel orders={pharmacyOrders.map((order) => ({
                        token: order.order_id,
                        patient: order.patient_id,
                        patientId: order.patient_id,
                        status: order.status,
                        items: order.medicines.length,
                        medicines: order.medicines.map((item) => ({ medicine: item.medicine_name, tablets: item.dosage, times: item.frequency })),
                    }))} />}
                </div>
            </div>

            <Modal
                open={showBookingModal}
                onClose={() => setShowBookingModal(false)}
                title="Book Appointment"
                eyebrow="Patient Booking"
                maxWidthClass="max-w-2xl"
            >
                <div className="space-y-6">
                    <div className="grid gap-3 rounded-[26px] bg-[rgba(245,238,228,0.92)] p-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-white/85 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Booking Rule</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">25% advance at booking</p>
                        </div>
                        <div className="rounded-2xl bg-white/85 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Slot Changes</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">Discounts apply automatically</p>
                        </div>
                        <div className="rounded-2xl bg-white/85 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Confirmation</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">App confirmation if rescheduled</p>
                        </div>
                    </div>

                    <form onSubmit={handleBookingSubmit} className="grid gap-5">
                        <div className="rounded-[26px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Step 1</p>
                                    <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Pick a date and doctor</h3>
                                </div>
                                {bookingForm.doctor && bookingForm.date ? (
                                    <span className="rounded-full bg-[#e8f3fb] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                                        Ready for time slot
                                    </span>
                                ) : null}
                            </div>

                            <div className="mt-5 grid gap-5">
                                <label className="space-y-2 block">
                                    <span className="block text-sm font-semibold text-[var(--ink)]">Preferred date</span>
                                    <span className="block text-xs text-[var(--muted)]">Choose your desired visit day</span>
                                    <div className="rounded-[20px] border border-[rgba(216,206,193,0.8)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
                                        {formatDateDisplay(bookingForm.date)}
                                    </div>
                                    <BookingCalendar value={bookingForm.date} onChange={(nextDate) => handleBookingChange("date", nextDate)} />
                                </label>

                                <div className="space-y-2">
                                    <span className="block text-sm font-semibold text-[var(--ink)]">Choose Doctor</span>
                                    <span className="block text-xs text-[var(--muted)]">Specialty and clinic are linked to the doctor card</span>
                                    <div className="grid max-h-[190px] gap-3 overflow-y-auto pr-1">
                                        {doctorDirectory.map((doctor) => {
                                            const selected = bookingForm.doctor === doctor.name
                                            return (
                                                <button
                                                    key={doctor.name}
                                                    type="button"
                                                    onClick={() => handleDoctorCardSelect(doctor)}
                                                    className={`rounded-[20px] border px-4 py-3 text-left ${
                                                        selected
                                                            ? "border-[#9fcceb] bg-[#eaf4fb]"
                                                            : "border-[var(--line)] bg-white"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-[var(--ink)]">{doctor.name}</p>
                                                            <p className="mt-1 text-sm text-[var(--muted)]">{doctor.specialty}</p>
                                                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{doctor.location}</p>
                                                        </div>
                                                        {selected ? (
                                                            <span className="rounded-full bg-[#cfe6f7] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                                                                Selected
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {bookingForm.doctor && bookingForm.date ? (
                            <div className="rounded-[26px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Step 2</p>
                                <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Choose a time slot</h3>
                                <p className="mt-2 text-xs text-[var(--muted)]">30-minute slots from 11:00 AM to 5:00 PM. Red means booked, green means available.</p>
                                <div className="mt-5 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {appointmentTimeSlots.map((slot) => {
                                        const selected = bookingForm.time === slot.time
                                        const booked = slot.status === "booked"

                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                disabled={booked}
                                                onClick={() => handleBookingChange("time", slot.time)}
                                                className={`rounded-[18px] border px-4 py-3 text-left ${
                                                    booked
                                                        ? "cursor-not-allowed border-[#efb4b4] bg-[#fff1f1] text-[#a45858]"
                                                        : selected
                                                            ? "border-[#7fc18f] bg-[#eef9f1] text-[var(--ink)]"
                                                            : "border-[#b8dfc1] bg-white text-[var(--ink)]"
                                                }`}
                                            >
                                                <p className="font-semibold">{slot.time}</p>
                                                <p className="mt-1 text-xs">
                                                    {booked ? "Booked" : selected ? "Selected" : "Available"}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {bookingForm.time ? (
                            <div className="rounded-[26px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Step 3</p>
                                <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Complete advance payment</h3>
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {[
                                        ["upi", "UPI"],
                                        ["credit-card", "Credit Card"],
                                        ["debit-card", "Debit Card"],
                                        ["net-banking", "Net Banking"],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                setBookingForm((current) => ({
                                                    ...current,
                                                    paymentMethod: value,
                                                    upiId: "",
                                                    cardName: "",
                                                    cardNumber: "",
                                                    expiry: "",
                                                    cvv: "",
                                                    bankName: "",
                                                }))
                                            }
                                            className={`rounded-[20px] border px-4 py-4 text-left ${
                                                bookingForm.paymentMethod === value
                                                    ? "border-[#b9d7eb] bg-[#e8f3fb]"
                                                    : "border-[var(--line)] bg-white"
                                            }`}
                                        >
                                            <p className="font-semibold text-[var(--ink)]">{label}</p>
                                            <p className="mt-1 text-xs text-[var(--muted)]">
                                                {value === "upi"
                                                    ? "Fast QR or UPI app payment"
                                                    : value === "credit-card"
                                                        ? "Pay with credit card"
                                                        : value === "debit-card"
                                                            ? "Pay with debit card"
                                                            : "Use internet banking"}
                                            </p>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4 rounded-[22px] border border-[rgba(216,206,193,0.8)] bg-white px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Payment Details</p>

                                    {bookingForm.paymentMethod === "upi" ? (
                                        <div className="mt-3 space-y-2">
                                            <div className="rounded-[20px] border border-[rgba(216,206,193,0.8)] bg-[var(--panel-muted)] p-4">
                                                <div className="relative overflow-hidden rounded-[18px] bg-white p-3">
                                                    <img
                                                        src={upiQrCode}
                                                        alt="UPI QR Code"
                                                        className={`mx-auto h-44 w-44 object-contain transition-all ${useQrPayment ? "" : "blur-[6px] scale-105"}`}
                                                    />
                                                    {!useQrPayment ? (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.28)]">
                                                            <Button
                                                                type="button"
                                                                onClick={() => setUseQrPayment(true)}
                                                                className="px-5 py-2"
                                                            >
                                                                USE QR CODE
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                                                    Scan this QR if you want to complete the advance payment using any supported UPI app.
                                                </p>
                                            </div>

                                            <label className="block">
                                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">UPI ID</span>
                                                <input
                                                    value={bookingForm.upiId}
                                                    onChange={(event) => handleBookingChange("upiId", event.target.value)}
                                                    disabled={useQrPayment}
                                                    className={`w-full rounded-[16px] border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink)] outline-none ${
                                                        useQrPayment ? "cursor-not-allowed bg-[rgba(238,232,225,0.8)] text-[rgba(45,50,56,0.55)]" : "bg-[var(--panel-muted)]"
                                                    }`}
                                                    placeholder="name@bank"
                                                />
                                            </label>
                                            <p className="text-xs leading-6 text-[var(--muted)]">Pay instantly with any supported UPI app.</p>
                                        </div>
                                    ) : null}

                                    {(bookingForm.paymentMethod === "credit-card" || bookingForm.paymentMethod === "debit-card") ? (
                                        <div className="mt-3 grid gap-3">
                                            <label className="block">
                                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Cardholder Name</span>
                                                <input
                                                    value={bookingForm.cardName}
                                                    onChange={(event) => handleBookingChange("cardName", event.target.value)}
                                                    className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                                    placeholder="Name on card"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Card Number</span>
                                                <input
                                                    value={bookingForm.cardNumber}
                                                    onChange={(event) => handleBookingChange("cardNumber", formatCardNumber(event.target.value))}
                                                    className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                                    placeholder="1234 5678 9012 3456"
                                                    inputMode="numeric"
                                                />
                                            </label>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Expiry</span>
                                                    <input
                                                        value={bookingForm.expiry}
                                                        onChange={(event) => handleBookingChange("expiry", formatExpiryInput(event.target.value))}
                                                        className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                                        placeholder="MM/YY"
                                                        inputMode="numeric"
                                                    />
                                                </label>
                                                <label className="block">
                                                    <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">CVV</span>
                                                    <input
                                                        value={bookingForm.cvv}
                                                        onChange={(event) => handleBookingChange("cvv", digitsOnly(event.target.value).slice(0, 3))}
                                                        className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                                        placeholder="123"
                                                        inputMode="numeric"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    ) : null}

                                    {bookingForm.paymentMethod === "net-banking" ? (
                                        <div className="mt-3 space-y-2">
                                            <label className="block">
                                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Bank Name</span>
                                                <select
                                                    value={bookingForm.bankName}
                                                    onChange={(event) => handleBookingChange("bankName", event.target.value)}
                                                    className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                                >
                                                    <option value="">Select your bank</option>
                                                    <option value="State Bank of India">State Bank of India</option>
                                                    <option value="HDFC Bank">HDFC Bank</option>
                                                    <option value="ICICI Bank">ICICI Bank</option>
                                                    <option value="Axis Bank">Axis Bank</option>
                                                </select>
                                            </label>
                                            <p className="text-xs leading-6 text-[var(--muted)]">You will be redirected to your bank portal for secure authentication.</p>
                                        </div>
                                    ) : null}

                                    {bookingForm.time && (paymentValidationMessage || paymentError) ? (
                                        <p className="mt-3 text-sm text-[#9a5a53]">{paymentValidationMessage || paymentError}</p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Selected Doctor</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{bookingForm.doctor || "Choose doctor from the list above"}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{bookingForm.specialty || "Specialty will appear here"}</p>
                                <p className="mt-2 text-sm text-[var(--muted)]">{bookingForm.location || "Clinic location will appear here"}</p>
                            </div>

                            <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Payment</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">Advance booking charge: 25%</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                    Method: {paymentMethodLabel(bookingForm.paymentMethod)}
                                </p>
                                <p className="mt-2 text-sm text-[var(--muted)]">Estimated advance: Rs. 300</p>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(245,238,228,0.92)] px-4 py-4">
                            <p className="text-sm font-semibold text-[var(--ink)]">Booking Summary</p>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                Submit this request to reserve your preferred slot. If hospital optimization changes the slot, CareOS will notify you and apply the appropriate consultation and medicine discounts automatically.
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                className="px-6"
                                disabled={Boolean(paymentValidationMessage)}
                            >
                                Pay Advance & Confirm
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal
                open={Boolean(selectedAppointment)}
                onClose={() => setSelectedAppointment(null)}
                title="Appointment Details"
                eyebrow="Patient Appointment"
            >
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[
                            ["Date", selectedAppointment?.date],
                            ["Time", selectedAppointment?.time],
                            ["Doctor", selectedAppointment?.doctor],
                            ["Specialty", selectedAppointment?.specialty],
                            ["Location", selectedAppointment?.location],
                            ["Status", selectedAppointment?.status],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.16em]">{label}</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <Button variant="subtle" onClick={() => setSelectedAppointment(null)}>Close</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={Boolean(bookingTicket)}
                onClose={() => setBookingTicket(null)}
                title="Appointment Confirmed"
                eyebrow="Booking Ticket"
                maxWidthClass="max-w-lg"
            >
                <div className="space-y-5">
                    <div className="rounded-[26px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Booking ID</p>
                        <h3 className="mt-2 font-display text-3xl text-[var(--ink)]">{bookingTicket?.bookingId}</h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                            Your appointment request is confirmed and the advance payment has been recorded successfully.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Date</p>
                            <p className="mt-2 font-semibold text-[var(--ink)]">{bookingTicket?.date}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Time</p>
                            <p className="mt-2 font-semibold text-[var(--ink)]">{bookingTicket?.time}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Doctor</p>
                            <p className="mt-2 font-semibold text-[var(--ink)]">{bookingTicket?.doctor}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{bookingTicket?.specialty}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Location</p>
                            <p className="mt-2 font-semibold text-[var(--ink)]">{bookingTicket?.location}</p>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-white px-4 py-4">
                        <p className="text-sm font-semibold text-[var(--ink)]">Payment Receipt</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">Method: {bookingTicket?.paymentMethod}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Advance Paid: {bookingTicket?.amount}</p>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="subtle" onClick={downloadTicket} className="px-6">Download Ticket</Button>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default PatientDashboard
