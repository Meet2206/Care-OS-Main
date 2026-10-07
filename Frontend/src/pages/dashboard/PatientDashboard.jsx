import { useEffect, useState } from "react"
import QRCode from "qrcode"
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
import { getAppointmentScheduleError, getAppointmentTimeSlots } from "../../utils/appointmentSchedule"
import {
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

function formatCardNumber(value) {
    return value
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(\d{4})(?=\d)/g, "$1 ")
}

function formatCardExpiry(value) {
    const digits = value.replace(/\D/g, "").slice(0, 4)
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

function getBookingValidationMessage(form) {
    if (!form.doctor_id) return "Choose a doctor."
    if (!form.date) return "Choose a date."
    if (!form.time) return "Choose a time slot."
    return ""
}

function getPatientDashboardTitle(patient, user) {
    const fullName = patient?.full_name?.trim() || user?.full_name?.trim()
    const firstName = fullName?.split(/\s+/)[0]
    return firstName ? `${firstName}'s Dashboard` : "Patient Dashboard"
}

function PatientDashboard() {
    const { user } = useAuth()
    const [patient, setPatient] = useState(null)
    const [patientLoadError, setPatientLoadError] = useState("")
    const [appointments, setAppointments] = useState([])
    const [records, setRecords] = useState([])
    const [pharmacyOrders, setPharmacyOrders] = useState([])
    const [pharmacyOrderError, setPharmacyOrderError] = useState("")
    const [pharmacyOrderMessage, setPharmacyOrderMessage] = useState("")
    const [selectedPharmacyOrder, setSelectedPharmacyOrder] = useState(null)
    const [pharmacyPaymentForm, setPharmacyPaymentForm] = useState({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
    const [pharmacyPaymentError, setPharmacyPaymentError] = useState("")
    const [pharmacyPaymentBusy, setPharmacyPaymentBusy] = useState(false)
    const [pickupQrCode, setPickupQrCode] = useState("")
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [selectedSupport, setSelectedSupport] = useState("")
    const [bookingTicket, setBookingTicket] = useState(null)
    const [bookingError, setBookingError] = useState("")
    const [booking, setBooking] = useState(false)
    const [paymentForm, setPaymentForm] = useState({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
    const [doctorDirectory, setDoctorDirectory] = useState([])
    const [bookedTimes, setBookedTimes] = useState([])
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
            setPatient(null)
            setAppointments([])
            setRecords([])
            setPharmacyOrders([])
            setPatientLoadError("This account is not linked to a patient profile yet.")
            return
        }
        let active = true
        setPatient(null)
        setPatientLoadError("")
        Promise.all([
            apiRequest(`/patients/${user.patient_id}`),
            apiRequest("/appointments?limit=100"),
            apiRequest("/medical-records?limit=100"),
            apiRequest("/pharmacy-orders"),
            apiRequest("/doctors?limit=100"),
        ]).then(([profile, appointmentResult, recordResult, orderResult, doctorResult]) => {
            if (!active) return
            setPatient(profile)
            setAppointments(appointmentResult.data.map((item) => ({
                ...item,
                date: item.appointment_date,
                time: item.appointment_time,
                doctor: item.doctor_id,
                specialty: item.appointment_type,
                location: "6th Floor, New Building, Near L Block, Care HOS",
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
                location: item.address || "6th Floor, New Building, Near L Block, Care HOS",
                cabin: item.cabin || "Cabin not assigned",
                availability: item.availability,
                consultationFee: Number(item.consultation_fee || 0),
            })))
        }).catch((error) => {
            if (!active) return
            setPatientLoadError(error.message || "Unable to load your patient profile.")
            setPharmacyOrderError(error.message || "Unable to load pharmacy orders.")
        })
        return () => { active = false }
    }, [user?.patient_id])

    useEffect(() => {
        let active = true
        if (!selectedPharmacyOrder?.pickup_qr_payload) {
            setPickupQrCode("")
            return undefined
        }
        QRCode.toDataURL(selectedPharmacyOrder.pickup_qr_payload, { margin: 2, width: 240 })
            .then((dataUrl) => { if (active) setPickupQrCode(dataUrl) })
            .catch(() => { if (active) setPickupQrCode("") })
        return () => { active = false }
    }, [selectedPharmacyOrder?.pickup_qr_payload])

    useEffect(() => {
        if (!bookingForm.doctor_id || !bookingForm.date) {
            setBookedTimes([])
            return undefined
        }
        let active = true
        apiRequest(`/appointments/availability?doctor_id=${encodeURIComponent(bookingForm.doctor_id)}&appointment_date=${bookingForm.date}`)
            .then((times) => { if (active) setBookedTimes(times) })
            .catch(() => { if (active) setBookedTimes([]) })
        return () => { active = false }
    }, [bookingForm.doctor_id, bookingForm.date])

    const patientProfileData = patient ? {
        id: patient.patient_id,
        insurance: patient.status || "Active",
        phone: patient.phone || "Not provided",
        bloodGroup: patient.blood_group || "Not provided",
        assistance: "Contact reception for assistance",
    } : patientProfile

    const assignedDoctor = doctorDirectory.find((doctor) => doctor.id === patient?.assigned_doctor_id)
    const liveAppointmentUpdates = appointments.slice(0, 3).map((appointment) => {
        const tone = appointment.status === "Scheduled" ? "green" : appointment.status === "Cancelled" ? "coral" : appointment.status === "Payment Pending" ? "amber" : "blue"
        return {
            title: `${appointment.appointment_id} · ${appointment.doctor}`,
            detail: `${appointment.status} · ${formatDateDisplay(appointment.date)} at ${appointment.time}. ${appointment.specialty}.`,
            tone,
            status: appointment.status,
        }
    })

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
            location: `${doctor.location} · ${doctor.cabin}`,
        }))
        setPaymentForm({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
    }

    const selectedDoctor = doctorDirectory.find((doctor) => doctor.id === bookingForm.doctor_id)
    const appointmentTimeSlots = getAppointmentTimeSlots(bookingForm.date).map((slot) => ({
        ...slot,
        status: bookedTimes.find((entry) => entry.time === slot.time)?.available === false ? "booked" : "available",
    }))
    const totalAmount = selectedDoctor?.consultationFee || 0
    const advanceAmount = Math.round(totalAmount * 25) / 100
    const remainingAmount = Math.round((totalAmount - advanceAmount) * 100) / 100

    const updatePaymentField = (field, value) => {
        setPaymentForm((current) => ({ ...current, [field]: value }))
        setBookingError("")
    }

    const selectPharmacyFulfillment = async (order, choice) => {
        setPharmacyOrderError("")
        setPharmacyOrderMessage("")
        try {
            const updated = await apiRequest(`/pharmacy-orders/${order.order_id}/fulfillment`, {
                method: "POST",
                body: JSON.stringify({ fulfillment_choice: choice }),
            })
            setPharmacyOrders((current) => current.map((item) => item.order_id === updated.order_id ? updated : item))
            setSelectedPharmacyOrder(updated)
            setPharmacyPaymentError("")
            setPharmacyOrderMessage(`${choice} quantity selected for ${updated.order_id}. Complete payment to release it for pickup.`)
        } catch (error) {
            setPharmacyOrderError(error.message || "Unable to save the fulfillment choice.")
        }
    }

    const openPharmacyPayment = (order) => {
        setSelectedPharmacyOrder(order)
        setPharmacyPaymentForm({ method: "", upiId: "", cardNumber: "", expiry: "", cvv: "" })
        setPharmacyPaymentError("")
    }

    const submitPharmacyPayment = async (event) => {
        event.preventDefault()
        const form = pharmacyPaymentForm
        if (!form.method) return setPharmacyPaymentError("Choose a payment method.")
        if (form.method === "UPI ID" && !/^[-a-zA-Z0-9._]{2,}@[a-zA-Z]{2,}$/.test(form.upiId.trim())) return setPharmacyPaymentError("Enter a valid UPI ID.")
        if (["Credit Card", "Debit Card"].includes(form.method)) {
            if (!/^\d{16}$/.test(form.cardNumber.replace(/\s/g, ""))) return setPharmacyPaymentError("Card number must contain exactly 16 digits.")
            const expiry = /^(\d{2})\/(\d{2})$/.exec(form.expiry)
            if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) return setPharmacyPaymentError("Enter a valid card expiry as MM/YY.")
            const now = new Date()
            if (2000 + Number(expiry[2]) < now.getFullYear() || (2000 + Number(expiry[2]) === now.getFullYear() && Number(expiry[1]) < now.getMonth() + 1)) return setPharmacyPaymentError("This card has expired.")
            if (!/^\d{3}$/.test(form.cvv)) return setPharmacyPaymentError("CVV must contain exactly 3 digits.")
        }
        setPharmacyPaymentBusy(true)
        setPharmacyPaymentError("")
        try {
            const updated = await apiRequest(`/pharmacy-orders/${selectedPharmacyOrder.order_id}/payment`, {
                method: "POST",
                body: JSON.stringify({
                    payment_method: form.method,
                    ...(form.method === "UPI ID" ? { upi_id: form.upiId.trim() } : {}),
                    ...(["Credit Card", "Debit Card"].includes(form.method) ? { card_last4: form.cardNumber.replace(/\s/g, "").slice(-4) } : {}),
                }),
            })
            setPharmacyOrders((current) => current.map((item) => item.order_id === updated.order_id ? updated : item))
            setSelectedPharmacyOrder(updated)
            setPharmacyOrderMessage(updated.payment_status === "Paid" ? `${updated.order_id} is paid and ready for pickup.` : `${updated.order_id} is pending cash confirmation at the pharmacy.`)
        } catch (error) {
            setPharmacyPaymentError(error.message || "Unable to process pharmacy payment.")
        } finally {
            setPharmacyPaymentBusy(false)
        }
    }

    const getPaymentValidationMessage = () => {
        if (!paymentForm.method) return "Choose a payment method."
        if (paymentForm.method === "UPI ID" && !/^[-a-zA-Z0-9._]{2,}@[a-zA-Z]{2,}$/.test(paymentForm.upiId.trim())) return "Enter a valid UPI ID."
        if (["Credit Card", "Debit Card"].includes(paymentForm.method)) {
            const normalizedCardNumber = paymentForm.cardNumber.replace(/\s/g, "")
            if (!/^\d{16}$/.test(normalizedCardNumber)) return "Card number must contain exactly 16 digits."
            const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(paymentForm.expiry)
            if (!expiryMatch) return "Enter card expiry as MM/YY."
            const expiryMonth = Number(expiryMatch[1])
            const expiryYear = 2000 + Number(expiryMatch[2])
            const now = new Date()
            if (expiryMonth < 1 || expiryMonth > 12) return "Enter a valid expiry month."
            if (expiryYear < now.getFullYear() || (expiryYear === now.getFullYear() && expiryMonth < now.getMonth() + 1)) return "This card has expired."
            if (!/^\d{3}$/.test(paymentForm.cvv)) return "CVV must contain exactly 3 digits."
        }
        return ""
    }

    const handleBookingSubmit = async (event) => {
        event.preventDefault()
        const validationMessage = getBookingValidationMessage(bookingForm)
        const scheduleMessage = getAppointmentScheduleError(bookingForm.date, bookingForm.time)
        const bookedMessage = bookedTimes.find((entry) => entry.time === bookingForm.time)?.available === false ? "That time slot is full. Choose another slot." : ""
        const paymentValidationMessage = getPaymentValidationMessage()
        if (validationMessage || scheduleMessage || bookedMessage || paymentValidationMessage) {
            setBookingError(validationMessage || scheduleMessage || bookedMessage || paymentValidationMessage)
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
                patientId: patient?.patient_id || user.patient_id,
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
    const bookingScheduleMessage = getAppointmentScheduleError(bookingForm.date, bookingForm.time)
    const bookingSlotMessage = bookedTimes.find((entry) => entry.time === bookingForm.time)?.available === false ? "That time slot is full. Choose another slot." : ""
    const paymentValidationMessage = getPaymentValidationMessage()
    const displayAmount = (value) => value === null || value === undefined ? "—" : `₹${Number(value).toLocaleString("en-IN")}`

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
        const innerWidth = halfWidth - 32
        const wrap = (value, font, size) => {
            pdf.setFont(font, "normal")
            pdf.setFontSize(size)
            return pdf.splitTextToSize(String(value || "—"), innerWidth)
        }
        const currency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`
        const infoCards = [
            { label: "DATE", value: bookingTicket.date },
            { label: "TIME", value: bookingTicket.time },
            { label: "DOCTOR", value: bookingTicket.doctor, subtext: bookingTicket.specialty },
            { label: "LOCATION", value: bookingTicket.location },
        ]
        const rows = [infoCards.slice(0, 2), infoCards.slice(2)]
        const rowHeights = rows.map((row) => Math.max(...row.map((card) => {
            const valueLines = wrap(card.value, "helvetica", 13)
            const subtextLines = card.subtext ? wrap(card.subtext, "helvetica", 11) : []
            return Math.max(68, 30 + valueLines.length * 16 + subtextLines.length * 14)
        })))
        const paymentRows = [
            ["Payment Method", bookingTicket.paymentMethod],
            ["Advance Paid", currency(bookingTicket.advanceAmount)],
            ["Total Amount", currency(bookingTicket.totalAmount)],
            ["Balance Due", currency(bookingTicket.remainingAmount)],
            ["Transaction ID", bookingTicket.transactionReference],
        ]
        const paymentHeight = 48 + paymentRows.length * 17
        const infoStartY = 236
        const paymentY = infoStartY + rowHeights.reduce((sum, height) => sum + height, 0) + 18
        const cardBottom = paymentY + paymentHeight
        const pageHeight = cardBottom + 36
        pdf.internal.pageSize.setHeight(pageHeight)

        pdf.setFillColor(244, 239, 231)
        pdf.rect(0, 0, pageWidth, pageHeight, "F")
        pdf.setFillColor(252, 246, 238)
        pdf.setDrawColor(216, 206, 193)
        pdf.roundedRect(margin, 36, cardWidth, cardBottom - 20, 22, 22, "FD")

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

        let rowY = infoStartY
        rows.forEach((row, rowIndex) => {
            row.forEach((card, col) => {
                const x = margin + 20 + col * (halfWidth + 12)
                const height = rowHeights[rowIndex]
                const valueLines = wrap(card.value, "helvetica", 13)
                const subtextLines = card.subtext ? wrap(card.subtext, "helvetica", 11) : []
                pdf.setFillColor(245, 241, 235)
                pdf.roundedRect(x, rowY, halfWidth, height, 16, 16, "F")
                pdf.setFont("helvetica", "bold")
                pdf.setFontSize(9)
                pdf.setTextColor(110, 116, 111)
                pdf.text(card.label, x + 16, rowY + 18)
                pdf.setFont("helvetica", "bold")
                pdf.setFontSize(13)
                pdf.setTextColor(45, 50, 56)
                pdf.text(valueLines, x + 16, rowY + 40, { lineHeightFactor: 1.2 })
                if (subtextLines.length) {
                    pdf.setFont("helvetica", "normal")
                    pdf.setFontSize(11)
                    pdf.setTextColor(110, 116, 111)
                    pdf.text(subtextLines, x + 16, rowY + 40 + valueLines.length * 16 + 2, { lineHeightFactor: 1.2 })
                }
            })
            rowY += rowHeights[rowIndex]
        })

        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(216, 206, 193)
        pdf.roundedRect(margin + 20, paymentY, cardWidth - 40, paymentHeight, 18, 18, "FD")
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(12)
        pdf.setTextColor(45, 50, 56)
        pdf.text("Payment Receipt", margin + 38, paymentY + 26)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(11)
        paymentRows.forEach(([label, value], index) => {
            const y = paymentY + 48 + index * 17
            pdf.text(`${label}:`, margin + 38, y)
            pdf.text(String(value || "—"), margin + 210, y)
        })

        pdf.save(`${bookingTicket.bookingId}.pdf`)
    }

    return (
        <>
            <div className="space-y-6">
                <PageIntro
                    eyebrow="Patient Portal"
                    title={getPatientDashboardTitle(patient, user)}
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

                <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <AppointmentStatusPanel updates={liveAppointmentUpdates} />
                    <AssistancePanel
                        options={patientSupportOptions}
                        selectedOption={selectedSupport}
                        onSelect={setSelectedSupport}
                    />
                </div>

                <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                    <Card className="min-w-0 p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="font-display text-3xl text-[var(--ink)]">My Upcoming Appointments</h2>
                            <Button variant="subtle" onClick={() => setShowBookingModal(true)}>New Booking</Button>
                        </div>
                        <div className="mt-5 grid gap-3">
                            {appointments.length ? appointments.map((appointment) => (
                                <article key={`${appointment.date}-${appointment.time}-${appointment.doctor}`} className="min-w-0 rounded-[22px] border border-[var(--line)] bg-[var(--panel-muted)]/55 p-4 sm:p-5">
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{appointment.appointment_id}</p>
                                            <h3 className="mt-1 break-words text-lg font-semibold text-[var(--ink)]">{appointment.doctor}</h3>
                                            <p className="mt-1 break-words text-sm text-[var(--muted)]">{appointment.specialty}</p>
                                        </div>
                                        <StatusPill tone={appointment.status === "Scheduled" ? "green" : appointment.status === "Requested" ? "blue" : "amber"}>
                                            {appointment.status}
                                        </StatusPill>
                                    </div>
                                    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="min-w-0 rounded-2xl bg-white/75 px-3 py-3">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Date &amp; Time</p>
                                            <p className="mt-1 font-semibold text-[var(--ink)]">{formatDateDisplay(appointment.date)}</p>
                                            <p className="text-sm text-[var(--muted)]">{appointment.time}</p>
                                        </div>
                                        <div className="min-w-0 rounded-2xl bg-white/75 px-3 py-3 sm:col-span-1 lg:col-span-2">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Location</p>
                                            <p className="mt-1 break-words text-sm leading-6 text-[var(--ink)]">{appointment.location}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button variant="subtle" className="px-4 py-2" onClick={() => setSelectedAppointment(appointment)}>
                                            View Details
                                        </Button>
                                    </div>
                                </article>
                            )) : (
                                <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-[var(--panel-muted)]/45 px-5 py-8 text-center text-sm text-[var(--muted)]">
                                    No upcoming appointments.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="min-w-0 p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Assigned Doctor</h2>
                        <div className="mt-5 space-y-4">
                            {assignedDoctor ? (
                                <div className="flex min-w-0 flex-wrap items-start gap-4 rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c7def5_0%,#d8efd5_100%)] text-lg font-semibold text-[var(--ink)]">
                                        {assignedDoctor.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                                    </div>
                                    <div className="min-w-0 flex-1 break-words">
                                        <p className="font-semibold text-[var(--ink)]">{assignedDoctor.name}</p>
                                        <p className="break-words text-sm text-[var(--muted)]">{assignedDoctor.specialty}</p>
                                        <p className="break-words text-xs text-[var(--muted)]">{assignedDoctor.location}</p>
                                    </div>
                                    <div className="shrink-0"><StatusPill tone="blue">Primary</StatusPill></div>
                                </div>
                            ) : (
                                <p className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4 text-sm text-[var(--muted)]">No doctor assigned.</p>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <Card className="min-w-0 p-6">
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

                    {pharmacyOrderError ? <div className="min-w-0 rounded-2xl border border-[#f0c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{pharmacyOrderError}</div> : <div className="min-w-0"><PrescriptionOrdersPanel orders={pharmacyOrders} onFulfillment={selectPharmacyFulfillment} onPayment={openPharmacyPayment} /></div>}
                </div>
            </div>

            {pharmacyOrderMessage ? <div className="rounded-2xl border border-[#d4e7d9] bg-[#eef8f0] px-4 py-3 text-sm text-[#4c6a56]">{pharmacyOrderMessage}</div> : null}

            <Modal
                open={Boolean(selectedPharmacyOrder)}
                onClose={() => setSelectedPharmacyOrder(null)}
                title={selectedPharmacyOrder ? `Pharmacy payment · ${selectedPharmacyOrder.order_id}` : "Pharmacy payment"}
                eyebrow="Medicine fulfillment"
                maxWidthClass="max-w-2xl"
            >
                {selectedPharmacyOrder?.payment_status === "Paid" ? (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-[#d4e7d9] bg-[#eef8f0] p-5">
                            <p className="font-semibold text-[#3e6b50]">Payment successful</p>
                            <p className="mt-2 text-sm text-[var(--muted)]">Order {selectedPharmacyOrder.order_id} is ready for pickup.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Pickup token / QR payload</p>
                            {pickupQrCode ? <img src={pickupQrCode} alt={`Secure pickup QR for ${selectedPharmacyOrder.order_id}`} className="mx-auto mt-4 h-52 w-52 rounded-xl border border-[var(--line)] bg-white p-2" /> : null}
                            <p className="mt-3 break-all rounded-xl bg-[var(--panel-muted)] px-3 py-3 font-mono text-xs text-[var(--ink)]">{selectedPharmacyOrder.pickup_qr_payload}</p>
                            <p className="mt-3 text-sm text-[var(--muted)]">Show this secure token at the pharmacy counter. The backend validates it and blocks reuse after collection.</p>
                        </div>
                        <Button variant="subtle" onClick={() => setSelectedPharmacyOrder(null)}>Close</Button>
                    </div>
                ) : (
                    <form onSubmit={submitPharmacyPayment} className="space-y-5">
                        <div className="rounded-2xl bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted)]">
                            <p className="font-semibold text-[var(--ink)]">Fulfillment: {selectedPharmacyOrder?.fulfillment_choice}</p>
                            <p className="mt-1">Total quantity is calculated from the unchanged doctor prescription. No raw card or UPI credential is stored.</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {["UPI", "UPI ID", "Credit Card", "Debit Card", "Cash", "On-Counter"].map((method) => (
                                <button key={method} type="button" onClick={() => setPharmacyPaymentForm((current) => ({ ...current, method }))} className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${pharmacyPaymentForm.method === method ? "border-[var(--primary-blue)] bg-white text-[var(--primary-blue)]" : "border-[var(--line)] bg-white/70 text-[var(--ink)]"}`}>{method}</button>
                            ))}
                        </div>
                        {pharmacyPaymentForm.method === "UPI" ? <div className="rounded-2xl bg-white p-4 text-sm text-[var(--muted)]">Use the existing UPI QR for this simulated payment, then choose Payment Done.</div> : null}
                        {pharmacyPaymentForm.method === "UPI ID" ? <input className="form-input" value={pharmacyPaymentForm.upiId} onChange={(event) => setPharmacyPaymentForm((current) => ({ ...current, upiId: event.target.value }))} placeholder="name@bank" autoComplete="off" /> : null}
                        {["Credit Card", "Debit Card"].includes(pharmacyPaymentForm.method) ? <div className="grid gap-3 sm:grid-cols-3"><input className="form-input sm:col-span-3" inputMode="numeric" maxLength={19} value={pharmacyPaymentForm.cardNumber} onChange={(event) => setPharmacyPaymentForm((current) => ({ ...current, cardNumber: formatCardNumber(event.target.value) }))} placeholder="1234 5678 9012 3456" autoComplete="off" /><input className="form-input" inputMode="numeric" maxLength={5} value={pharmacyPaymentForm.expiry} onChange={(event) => setPharmacyPaymentForm((current) => ({ ...current, expiry: formatCardExpiry(event.target.value) }))} placeholder="MM/YY" autoComplete="off" /><input className="form-input" inputMode="numeric" maxLength={3} value={pharmacyPaymentForm.cvv} onChange={(event) => setPharmacyPaymentForm((current) => ({ ...current, cvv: event.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="CVV" autoComplete="off" /></div> : null}
                        {pharmacyPaymentForm.method === "Cash" || pharmacyPaymentForm.method === "On-Counter" ? <p className="rounded-2xl bg-[#fff7e6] px-4 py-3 text-sm text-[#88651d]">Payment status remains Pending until pharmacy staff confirms receipt.</p> : null}
                        {pharmacyPaymentError ? <p className="rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{pharmacyPaymentError}</p> : null}
                        <div className="flex justify-end"><Button type="submit" disabled={pharmacyPaymentBusy}>{pharmacyPaymentBusy ? "Processing…" : "Payment Done"}</Button></div>
                    </form>
                )}
            </Modal>

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

                    <form onSubmit={handleBookingSubmit} className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <aside className="min-w-0 self-start rounded-[26px] border border-[#cfe3f2] bg-[#f3f9fc] p-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-blue)]">Need help?</p>
                            <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Call Reception</h3>
                            <a href="tel:9878798789" className="mt-4 block text-2xl font-semibold text-[var(--primary-blue)]">9878798789</a>
                            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Call to book an appointment or ask about available times.</p>
                        </aside>
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
                                                    className={`rounded-[20px] border px-4 py-3 text-left ${selected
                                                            ? "border-[#9fcceb] bg-[#eaf4fb]"
                                                            : "border-[var(--line)] bg-white"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-[var(--ink)]">{doctor.name}</p>
                                                            <p className="mt-1 text-sm text-[var(--muted)]">{doctor.specialty}</p>
                                                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{doctor.cabin} · {doctor.location}</p>
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
                                <p className="mt-2 text-xs text-[var(--muted)]">Select an available 30-minute consultation slot. Each doctor/time slot supports up to 3 patients. Sundays are holidays; Saturday timings are 11:00 AM–2:00 PM.</p>
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
                                                className={`rounded-[18px] border px-4 py-3 text-left ${booked
                                                        ? "cursor-not-allowed border-[#efb4b4] bg-[#fff1f1] text-[#a45858]"
                                                        : selected
                                                            ? "border-[#7fc18f] bg-[#eef9f1] text-[var(--ink)]"
                                                            : "border-[#b8dfc1] bg-white text-[var(--ink)]"
                                                    }`}
                                            >
                                                <p className="font-semibold">{slot.time}</p>
                                                <p className="mt-1 text-xs">
                                                    {booked ? "FULL" : `${bookedTimes.find((entry) => entry.time === slot.time)?.booked || 0} / 3 booked`}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <div className="grid items-start gap-4 md:grid-cols-2">
                            <div className="min-w-0 self-start rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Selected Doctor</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{bookingForm.doctor || "Choose doctor from the list above"}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{bookingForm.specialty || "Specialty will appear here"}</p>
                                <p className="mt-2 text-sm text-[var(--muted)]">{bookingForm.location || "Clinic location will appear here"}</p>
                            </div>

                            <div className="min-w-0 self-start rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Booking amount</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{totalAmount ? `₹${totalAmount.toLocaleString("en-IN")}` : "Select a doctor"}</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">The doctor’s consultation fee is used to calculate the advance.</p>
                            </div>
                        </div>

                        {bookingForm.doctor_id && bookingForm.date && bookingForm.time ? (
                            <div className="min-w-0 self-start rounded-[26px] border border-[#b9d9eb] bg-[#f0f8fc] p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Step 3 · Payment</p>
                                        <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Pay the 25% advance</h3>
                                    </div>
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
                                        <input className="form-input sm:col-span-3" inputMode="numeric" maxLength={19} value={paymentForm.cardNumber} onChange={(event) => updatePaymentField("cardNumber", formatCardNumber(event.target.value))} placeholder="1234 5678 9012 3456" autoComplete="off" />
                                        <input className="form-input" inputMode="numeric" maxLength={5} value={paymentForm.expiry} onChange={(event) => updatePaymentField("expiry", formatCardExpiry(event.target.value))} placeholder="MM/YY" autoComplete="off" />
                                        <input className="form-input" inputMode="numeric" maxLength={3} value={paymentForm.cvv} onChange={(event) => updatePaymentField("cvv", event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="3-digit CVV" autoComplete="off" />
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
                                disabled={booking || Boolean(bookingValidationMessage || bookingScheduleMessage || bookingSlotMessage || paymentValidationMessage)}
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
                            ["Total Amount", displayAmount(selectedAppointment?.total_amount)],
                            ["Advance Paid", displayAmount(selectedAppointment?.advance_amount)],
                            ["Total Paid", displayAmount(selectedAppointment?.paid_amount)],
                            ["Remaining Amount", displayAmount(selectedAppointment?.remaining_amount)],
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
                            <p className="mt-1 text-sm text-[var(--muted)]">{bookingTicket?.patientId || patient?.patient_id}</p>
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
                        <Button variant="subtle" onClick={downloadTicket} className="px-6">Download Receipt</Button>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default PatientDashboard
