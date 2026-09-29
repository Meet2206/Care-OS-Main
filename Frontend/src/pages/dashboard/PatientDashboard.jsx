import { useEffect, useState } from "react"
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
import { apiRequest } from "../../api/client"
import { useAuth } from "../../context/AuthContext"
import upiQrCode from "../../../../UPI.svg"
import {
    appointmentUpdates,
    appointmentTimeSlots,
    careTeam,
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

function getBookingValidationMessage(form) {
    if (!form.doctor_id) return "Choose a doctor."
    if (!form.date) return "Choose a date."
    if (!form.time) return "Choose a time slot."
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
    const [bookingError, setBookingError] = useState("")
    const [booking, setBooking] = useState(false)
    const [paymentForm, setPaymentForm] = useState({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
    const [doctorDirectory, setDoctorDirectory] = useState([])
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [bookingForm, setBookingForm] = useState({
        date: "",
        time: "",
        doctor_id: "",
        doctor: "",
        specialty: "",
        location: "",
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
            apiRequest("/doctors?limit=100"),
        ]).then(([profile, appointmentResult, recordResult, orderResult, doctorResult]) => {
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
            setDoctorDirectory(doctorResult.data.map((item) => ({
                id: item.doctor_id,
                name: `${item.first_name} ${item.last_name}`,
                specialty: item.specialization,
                location: item.department,
                availability: item.availability,
                consultationFee: Number(item.consultation_fee || 0),
            })))
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
        setBookingError("")
    }

    const handleDoctorCardSelect = (doctor) => {
        setBookingForm((current) => ({
            ...current,
            doctor_id: doctor.id,
            doctor: doctor.name,
            specialty: doctor.specialty,
            location: doctor.location,
        }))
        setPaymentForm({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
    }

    const selectedDoctor = doctorDirectory.find((doctor) => doctor.id === bookingForm.doctor_id)
    const totalAmount = selectedDoctor?.consultationFee || 0
    const advanceAmount = Math.round(totalAmount * 25) / 100
    const remainingAmount = Math.round((totalAmount - advanceAmount) * 100) / 100

    const updatePaymentField = (field, value) => {
        setPaymentForm((current) => ({ ...current, [field]: value }))
        setBookingError("")
    }

    const getPaymentValidationMessage = () => {
        if (!paymentForm.method) return "Choose a payment method."
        if (paymentForm.method === "UPI ID" && !/^[-a-zA-Z0-9._]{2,}@[a-zA-Z]{2,}$/.test(paymentForm.upiId.trim())) return "Enter a valid UPI ID."
        if (["Credit Card", "Debit Card"].includes(paymentForm.method)) {
            if (!/^\d{12,19}$/.test(paymentForm.cardNumber.replace(/\s/g, ""))) return "Enter a valid card number."
            if (!/^\d{2}\/\d{2}$/.test(paymentForm.expiry)) return "Enter card expiry as MM/YY."
            if (!/^\d{3,4}$/.test(paymentForm.cvv)) return "Enter a valid CVV."
        }
        return ""
    }

    const handleBookingSubmit = async (event) => {
        event.preventDefault()
        const validationMessage = getBookingValidationMessage(bookingForm)
        const paymentValidationMessage = getPaymentValidationMessage()
        if (validationMessage || paymentValidationMessage) {
            setBookingError(validationMessage || paymentValidationMessage)
            return
        }

        setBooking(true)
        setBookingError("")
        try {
            const created = await apiRequest("/appointments", {
                method: "POST",
                body: JSON.stringify({
                    patient_id: user.patient_id,
                    doctor_id: bookingForm.doctor_id,
                    appointment_date: bookingForm.date,
                    appointment_time: bookingForm.time.length === 5 ? `${bookingForm.time}:00` : bookingForm.time,
                    appointment_type: "General Consultation",
                    reason: "Patient-requested appointment",
                    status: "Payment Pending",
                }),
            })
            const payment = await apiRequest(`/appointments/${created.appointment_id}/advance-payment`, {
                method: "POST",
                body: JSON.stringify({
                    payment_method: paymentForm.method,
                    ...(paymentForm.method === "UPI ID" ? { upi_id: paymentForm.upiId.trim() } : {}),
                    ...(["Credit Card", "Debit Card"].includes(paymentForm.method)
                        ? { card_last4: paymentForm.cardNumber.replace(/\s/g, "").slice(-4) }
                        : {}),
                }),
            })
            setAppointments((current) => [
                {
                    ...created,
                    ...payment,
                    status: "Scheduled",
                    date: created.appointment_date,
                    time: created.appointment_time,
                    doctor: bookingForm.doctor,
                    specialty: bookingForm.specialty,
                    location: bookingForm.location,
                },
                ...current,
            ])
            setBookingTicket({
                bookingId: created.appointment_id,
                date: formatDateDisplay(bookingForm.date),
                time: bookingForm.time,
                doctor: bookingForm.doctor,
                specialty: bookingForm.specialty,
                location: bookingForm.location,
                status: "Scheduled",
                paymentStatus: payment.payment_status,
                totalAmount: payment.total_amount,
                advanceAmount: payment.advance_amount,
                remainingAmount: payment.remaining_amount,
                paymentMethod: payment.payment_method,
                transactionReference: payment.transaction_reference,
                patientName: patient?.full_name,
                amount: `₹${payment.advance_amount.toLocaleString("en-IN")}`,
            })
            setBookingForm({ date: "", time: "", doctor_id: "", doctor: "", specialty: "", location: "" })
            setPaymentForm({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
            setShowBookingModal(false)
        } catch (error) {
            setBookingError(error.message || "Unable to book this appointment.")
        } finally {
            setBooking(false)
        }
    }

    const bookingValidationMessage = getBookingValidationMessage(bookingForm)
    const paymentValidationMessage = getPaymentValidationMessage()

    const downloadTicket = async () => {
        if (!bookingTicket) {
            return
        }

        const { jsPDF } = await import("jspdf")

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

                <div className="flex flex-col gap-3 rounded-[24px] border border-[#cfe3f2] bg-[#eef7fc] px-5 py-4 sm:flex-row sm:items-start sm:gap-4" role="note" aria-label="Account inactivity notice">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--primary-blue)] shadow-sm" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                        <div>
                        <p className="font-semibold text-[var(--ink)]">Account Inactivity Notice</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Your CARE-OS account may be deleted if there is no account activity for 2 months or more. Please sign in regularly or contact reception if you need help keeping your account active.</p>
                    </div>
                </div>

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
                                <p className="mt-2 text-xs text-[var(--muted)]">Select an available 30-minute consultation slot. The selected time is sent to the hospital in 24-hour format.</p>
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

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Selected Doctor</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{bookingForm.doctor || "Choose doctor from the list above"}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{bookingForm.specialty || "Specialty will appear here"}</p>
                                <p className="mt-2 text-sm text-[var(--muted)]">{bookingForm.location || "Clinic location will appear here"}</p>
                            </div>

                            <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Booking amount</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{totalAmount ? `₹${totalAmount.toLocaleString("en-IN")}` : "Select a doctor"}</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">The doctor’s consultation fee is used to calculate the advance.</p>
                            </div>
                        </div>

                        {bookingForm.doctor_id && bookingForm.date && bookingForm.time ? (
                            <div className="rounded-[26px] border border-[#b9d9eb] bg-[#f0f8fc] p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Step 3 · Payment</p>
                                        <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Pay the 25% advance</h3>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--primary-blue)]">Demo Payment</span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">No payment gateway is connected. Choose a method and click Payment Done only after completing this simulated step.</p>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    {[
                                        ["Total Amount", totalAmount],
                                        ["Advance Required (25%)", advanceAmount],
                                        ["Remaining Amount", remainingAmount],
                                    ].map(([label, amount]) => (
                                        <div key={label} className="rounded-2xl bg-white px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
                                            <p className="mt-2 text-lg font-bold text-[var(--ink)]">₹{Number(amount).toLocaleString("en-IN")}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5">
                                    <p className="text-sm font-semibold text-[var(--ink)]">Select payment method</p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                        {["UPI", "UPI ID", "Credit Card", "Debit Card"].map((method) => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => updatePaymentField("method", method)}
                                                className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${paymentForm.method === method ? "border-[var(--primary-blue)] bg-white text-[var(--primary-blue)]" : "border-[var(--line)] bg-white/70 text-[var(--ink)]"}`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {paymentForm.method === "UPI ID" ? (
                                    <input className="form-input mt-4" value={paymentForm.upiId} onChange={(event) => updatePaymentField("upiId", event.target.value)} placeholder="Enter UPI ID, e.g. name@bank" autoComplete="off" />
                                ) : null}
                                {paymentForm.method === "UPI" ? (
                                    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-white px-4 py-4 text-center sm:flex-row sm:items-center sm:text-left">
                                        <img src={upiQrCode} alt="UPI payment QR code" className="h-36 w-36 rounded-xl border border-[var(--line)] bg-white p-2" />
                                        <div>
                                            <p className="font-semibold text-[var(--ink)]">Scan to pay the advance</p>
                                            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Scan this QR code with your UPI app, complete the simulated payment, then click Payment Done.</p>
                                        </div>
                                    </div>
                                ) : null}
                                {["Credit Card", "Debit Card"].includes(paymentForm.method) ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        <input className="form-input sm:col-span-3" inputMode="numeric" value={paymentForm.cardNumber} onChange={(event) => updatePaymentField("cardNumber", event.target.value.replace(/[^\d ]/g, "").slice(0, 19))} placeholder="Card number" autoComplete="off" />
                                        <input className="form-input" value={paymentForm.expiry} onChange={(event) => updatePaymentField("expiry", event.target.value.replace(/[^\d/]/g, "").slice(0, 5))} placeholder="MM/YY" autoComplete="off" />
                                        <input className="form-input" inputMode="numeric" value={paymentForm.cvv} onChange={(event) => updatePaymentField("cvv", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="CVV" autoComplete="off" />
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(245,238,228,0.92)] px-4 py-4">
                            <p className="text-sm font-semibold text-[var(--ink)]">Booking Summary</p>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                Your booking is created as Payment Pending first. It becomes confirmed only after the simulated advance payment succeeds.
                            </p>
                        </div>

                        {bookingError ? (
                            <p className="text-wrap-anywhere rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{bookingError}</p>
                        ) : null}

                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                className="px-6"
                                disabled={booking || Boolean(bookingValidationMessage || paymentValidationMessage)}
                            >
                                {booking ? "Processing payment…" : "Payment Done"}
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
                            ["Payment Status", selectedAppointment?.payment_status || "Pending"],
                            ["Payment Method", selectedAppointment?.payment_method || "—"],
                            ["Total Amount", selectedAppointment?.total_amount ? `₹${Number(selectedAppointment.total_amount).toLocaleString("en-IN")}` : "—"],
                            ["Advance Paid", selectedAppointment?.advance_amount ? `₹${Number(selectedAppointment.advance_amount).toLocaleString("en-IN")}` : "—"],
                            ["Remaining Amount", selectedAppointment?.remaining_amount ? `₹${Number(selectedAppointment.remaining_amount).toLocaleString("en-IN")}` : "—"],
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
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Patient</p>
                            <p className="mt-2 font-semibold text-[var(--ink)]">{bookingTicket?.patientName || patient?.full_name}</p>
                        </div>
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
                        <p className="mt-1 text-sm text-[var(--muted)]">Total Amount: ₹{Number(bookingTicket?.totalAmount || 0).toLocaleString("en-IN")}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Remaining Amount: ₹{Number(bookingTicket?.remainingAmount || 0).toLocaleString("en-IN")}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Status: {bookingTicket?.paymentStatus}</p>
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
