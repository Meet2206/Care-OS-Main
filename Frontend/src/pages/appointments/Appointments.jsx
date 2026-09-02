import { useCallback, useEffect, useMemo, useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AsyncState from "../../components/common/AsyncState"
import Field, { Select, TextArea, TextInput } from "../../components/common/Field"
import { apiRequest } from "../../api/client"
import { useAuth } from "../../context/AuthContext"

const APPOINTMENT_TYPES = ["General Consultation", "Follow-up", "Emergency", "Routine Check-up"]
const STATUS_TONES = { Scheduled: "blue", Completed: "green", Cancelled: "coral", "No Show": "amber" }

function emptyAppointment() {
    return {
        patient_id: "",
        doctor_id: "",
        appointment_date: "",
        appointment_time: "",
        appointment_type: APPOINTMENT_TYPES[0],
        reason: "",
        notes: "",
    }
}

function emptyRecord() {
    return {
        diagnosis: "",
        symptoms: "",
        treatment: "",
        notes: "",
        follow_up_date: "",
        bp: "",
        pulse: "",
        temperature: "",
    }
}

function formatDate(value) {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
        ? String(value).slice(0, 10)
        : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

/**
 * Scheduling and consultation capture.
 *
 * This closes the gap between registering a patient and writing a prescription:
 * an appointment and its medical record previously had no interface at all, so
 * the clinical chain could only be completed by calling the API directly.
 */
function Appointments() {
    const { user } = useAuth()
    const isDoctor = user?.role === "doctor"
    const isPatient = user?.role === "patient"

    const [appointments, setAppointments] = useState([])
    const [patients, setPatients] = useState([])
    const [doctors, setDoctors] = useState([])
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState("")

    const [statusFilter, setStatusFilter] = useState("")
    const [query, setQuery] = useState("")

    const [showBooking, setShowBooking] = useState(false)
    const [form, setForm] = useState(emptyAppointment)
    const [formError, setFormError] = useState("")
    const [saving, setSaving] = useState(false)

    const [consultFor, setConsultFor] = useState(null)
    const [recordForm, setRecordForm] = useState(emptyRecord)
    const [recordError, setRecordError] = useState("")
    const [toast, setToast] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        setLoadError("")
        try {
            const requests = [apiRequest("/appointments?limit=100"), apiRequest("/doctors?limit=100")]
            requests.push(isPatient ? Promise.resolve({ data: [] }) : apiRequest("/patients?limit=100"))
            requests.push(isPatient || isDoctor ? apiRequest("/medical-records?limit=100") : Promise.resolve({ data: [] }))
            const [appointmentResult, doctorResult, patientResult, recordResult] = await Promise.all(requests)
            setAppointments(appointmentResult.data)
            setDoctors(doctorResult.data)
            setPatients(patientResult.data)
            setRecords(recordResult.data)
        } catch (error) {
            setLoadError(error.message || "Unable to load appointments.")
        } finally {
            setLoading(false)
        }
    }, [isDoctor, isPatient])

    useEffect(() => { load() }, [load])

    const recordByAppointment = useMemo(
        () => new Map(records.map((record) => [record.appointment_id, record])),
        [records],
    )
    const patientName = useCallback(
        (patientId) => patients.find((item) => item.patient_id === patientId)?.full_name || patientId,
        [patients],
    )
    const doctorName = useCallback((doctorId) => {
        const match = doctors.find((item) => item.doctor_id === doctorId)
        return match ? `${match.first_name} ${match.last_name}` : doctorId
    }, [doctors])

    const visible = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        return appointments
            .filter((item) => (statusFilter ? item.status === statusFilter : true))
            .filter((item) => {
                if (!normalized) return true
                return [item.appointment_id, item.patient_id, item.reason, patientName(item.patient_id)]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(normalized))
            })
            .sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date)))
    }, [appointments, statusFilter, query, patientName])

    const openBooking = () => {
        setForm({
            ...emptyAppointment(),
            patient_id: isPatient ? user.patient_id || "" : "",
            doctor_id: isDoctor ? user.doctor_id || "" : "",
        })
        setFormError("")
        setShowBooking(true)
    }

    const submitBooking = async (event) => {
        event.preventDefault()
        setFormError("")
        if (!form.patient_id || !form.doctor_id || !form.appointment_date || !form.appointment_time) {
            setFormError("Patient, doctor, date, and time are all required.")
            return
        }
        setSaving(true)
        try {
            await apiRequest("/appointments", {
                method: "POST",
                body: JSON.stringify({
                    ...form,
                    appointment_time: form.appointment_time.length === 5
                        ? `${form.appointment_time}:00`
                        : form.appointment_time,
                    notes: form.notes || null,
                }),
            })
            setShowBooking(false)
            setToast("Appointment booked.")
            await load()
        } catch (error) {
            setFormError(error.message || "Unable to book this appointment.")
        } finally {
            setSaving(false)
        }
    }

    const submitRecord = async (event) => {
        event.preventDefault()
        setRecordError("")
        if (!recordForm.diagnosis.trim() || !recordForm.symptoms.trim()) {
            setRecordError("Diagnosis and symptoms are required.")
            return
        }
        setSaving(true)
        try {
            const vitals = {}
            if (recordForm.bp) vitals.blood_pressure = recordForm.bp
            if (recordForm.pulse) vitals.pulse = recordForm.pulse
            if (recordForm.temperature) vitals.temperature = recordForm.temperature
            await apiRequest("/medical-records", {
                method: "POST",
                body: JSON.stringify({
                    appointment_id: consultFor.appointment_id,
                    patient_id: consultFor.patient_id,
                    doctor_id: user.doctor_id,
                    diagnosis: recordForm.diagnosis.trim(),
                    symptoms: recordForm.symptoms.trim(),
                    vital_signs: vitals,
                    treatment: recordForm.treatment || null,
                    notes: recordForm.notes || null,
                    follow_up_date: recordForm.follow_up_date || null,
                }),
            })
            await apiRequest(`/appointments/${consultFor.appointment_id}`, {
                method: "PUT",
                body: JSON.stringify({ status: "Completed" }),
            })
            setConsultFor(null)
            setToast("Consultation recorded. You can now prescribe from the doctor dashboard.")
            await load()
        } catch (error) {
            setRecordError(error.message || "Unable to save this consultation.")
        } finally {
            setSaving(false)
        }
    }

    const cancelAppointment = async (appointment) => {
        setToast("")
        try {
            await apiRequest(`/appointments/${appointment.appointment_id}`, {
                method: "PUT",
                body: JSON.stringify({ status: "Cancelled" }),
            })
            setToast(`${appointment.appointment_id} cancelled.`)
            await load()
        } catch (error) {
            setToast(error.message || "Unable to cancel this appointment.")
        }
    }

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Scheduling"
                title="Appointments"
                description="Book visits, record what happened in the consultation, and keep every prescription anchored to a real appointment."
                actions={<Button onClick={openBooking}>Book Appointment</Button>}
            />

            {toast ? (
                <div className="rounded-2xl border border-[#cfe6d8] bg-[#f0f9f4] px-4 py-3 text-sm text-[#337a52]">{toast}</div>
            ) : null}

            <Card className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                    <TextInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by patient, ID, or reason"
                        className="sm:flex-1"
                    />
                    <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="sm:w-56">
                        <option value="">All statuses</option>
                        {Object.keys(STATUS_TONES).map((value) => <option key={value} value={value}>{value}</option>)}
                    </Select>
                </div>
            </Card>

            <AsyncState
                loading={loading}
                error={loadError}
                onRetry={load}
                empty={visible.length === 0}
                emptyTitle="No appointments yet"
                emptyHint="Book the first appointment to start a patient's clinical record."
            >
                <Card className="min-w-0 p-5">
                    <div className="responsive-table scroll-table -mx-1 min-w-0 overflow-x-auto px-1">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                    <th className="py-3 pr-4">Appointment</th>
                                    <th className="py-3 pr-4">Patient</th>
                                    <th className="py-3 pr-4">Doctor</th>
                                    <th className="py-3 pr-4">When</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((appointment) => {
                                    const record = recordByAppointment.get(appointment.appointment_id)
                                    return (
                                        <tr key={appointment.appointment_id} className="border-t border-[var(--line)] align-top">
                                            <td className="py-3 pr-4 font-semibold text-[var(--ink)]" data-label="Appointment">
                                                {appointment.appointment_id}
                                                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{appointment.appointment_type}</span>
                                            </td>
                                            <td className="py-3 pr-4" data-label="Patient">{patientName(appointment.patient_id)}</td>
                                            <td className="py-3 pr-4" data-label="Doctor">{doctorName(appointment.doctor_id)}</td>
                                            <td className="py-3 pr-4" data-label="When">
                                                {formatDate(appointment.appointment_date)}
                                                <span className="mt-1 block text-xs text-[var(--muted)]">{appointment.appointment_time}</span>
                                            </td>
                                            <td className="py-3 pr-4" data-label="Status">
                                                <StatusPill tone={STATUS_TONES[appointment.status] || "neutral"}>{appointment.status}</StatusPill>
                                            </td>
                                            <td className="py-3" data-label="Actions">
                                                <div className="flex flex-wrap gap-2">
                                                    {isDoctor && !record ? (
                                                        <Button
                                                            className="px-4 py-1.5 text-xs"
                                                            onClick={() => { setConsultFor(appointment); setRecordForm(emptyRecord()); setRecordError("") }}
                                                        >
                                                            Record consultation
                                                        </Button>
                                                    ) : null}
                                                    {record ? <StatusPill tone="green">Record {record.record_id}</StatusPill> : null}
                                                    {appointment.status === "Scheduled" ? (
                                                        <Button variant="subtle" className="px-4 py-1.5 text-xs" onClick={() => cancelAppointment(appointment)}>
                                                            Cancel
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </AsyncState>

            <Modal open={showBooking} onClose={() => setShowBooking(false)} title="Book an appointment" eyebrow="Scheduling">
                <form onSubmit={submitBooking} className="grid gap-4 md:grid-cols-2">
                    {isPatient ? (
                        <Field label="Patient" className="md:col-span-2">
                            <TextInput value={user.patient_id || ""} readOnly />
                        </Field>
                    ) : (
                        <Field label="Patient" required className="md:col-span-2">
                            <Select value={form.patient_id} onChange={(event) => setForm({ ...form, patient_id: event.target.value })}>
                                <option value="">Select a patient</option>
                                {patients.map((patient) => (
                                    <option key={patient.patient_id} value={patient.patient_id}>
                                        {patient.full_name} ({patient.patient_id})
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}
                    <Field label="Doctor" required className="md:col-span-2">
                        <Select
                            value={form.doctor_id}
                            onChange={(event) => setForm({ ...form, doctor_id: event.target.value })}
                            disabled={isDoctor}
                        >
                            <option value="">Select a doctor</option>
                            {doctors.map((doctor) => (
                                <option key={doctor.doctor_id} value={doctor.doctor_id}>
                                    {doctor.first_name} {doctor.last_name} — {doctor.specialization}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Date" required>
                        <TextInput type="date" value={form.appointment_date} onChange={(event) => setForm({ ...form, appointment_date: event.target.value })} />
                    </Field>
                    <Field label="Time" required>
                        <TextInput type="time" value={form.appointment_time} onChange={(event) => setForm({ ...form, appointment_time: event.target.value })} />
                    </Field>
                    <Field label="Visit type">
                        <Select value={form.appointment_type} onChange={(event) => setForm({ ...form, appointment_type: event.target.value })}>
                            {APPOINTMENT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                        </Select>
                    </Field>
                    <Field label="Reason for visit" required>
                        <TextInput value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Persistent cough" />
                    </Field>
                    <Field label="Notes" className="md:col-span-2">
                        <TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                    </Field>
                    {formError ? (
                        <p className="md:col-span-2 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{formError}</p>
                    ) : null}
                    <div className="md:col-span-2 flex justify-end gap-3">
                        <Button type="button" variant="subtle" onClick={() => setShowBooking(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Booking…" : "Confirm booking"}</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={Boolean(consultFor)}
                onClose={() => setConsultFor(null)}
                title="Record consultation"
                eyebrow={consultFor ? `${consultFor.appointment_id} · ${patientName(consultFor.patient_id)}` : "Consultation"}
            >
                <form onSubmit={submitRecord} className="grid gap-4 md:grid-cols-2">
                    <Field label="Diagnosis" required className="md:col-span-2">
                        <TextInput value={recordForm.diagnosis} onChange={(event) => setRecordForm({ ...recordForm, diagnosis: event.target.value })} placeholder="Acute bronchitis" />
                    </Field>
                    <Field label="Symptoms" required className="md:col-span-2">
                        <TextInput value={recordForm.symptoms} onChange={(event) => setRecordForm({ ...recordForm, symptoms: event.target.value })} placeholder="Cough, fever, chest tightness" />
                    </Field>
                    <Field label="Blood pressure"><TextInput value={recordForm.bp} onChange={(event) => setRecordForm({ ...recordForm, bp: event.target.value })} placeholder="118/76" /></Field>
                    <Field label="Pulse"><TextInput value={recordForm.pulse} onChange={(event) => setRecordForm({ ...recordForm, pulse: event.target.value })} placeholder="92" /></Field>
                    <Field label="Temperature"><TextInput value={recordForm.temperature} onChange={(event) => setRecordForm({ ...recordForm, temperature: event.target.value })} placeholder="38.4" /></Field>
                    <Field label="Follow-up date"><TextInput type="date" value={recordForm.follow_up_date} onChange={(event) => setRecordForm({ ...recordForm, follow_up_date: event.target.value })} /></Field>
                    <Field label="Treatment" className="md:col-span-2">
                        <TextArea value={recordForm.treatment} onChange={(event) => setRecordForm({ ...recordForm, treatment: event.target.value })} />
                    </Field>
                    <Field label="Notes" className="md:col-span-2">
                        <TextArea value={recordForm.notes} onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })} />
                    </Field>
                    {recordError ? (
                        <p className="md:col-span-2 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{recordError}</p>
                    ) : null}
                    <div className="md:col-span-2 flex justify-end gap-3">
                        <Button type="button" variant="subtle" onClick={() => setConsultFor(null)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save consultation"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Appointments
