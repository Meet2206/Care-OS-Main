import { useCallback, useEffect, useMemo, useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AsyncState from "../../components/common/AsyncState"
import Field, { Select, TextArea, TextInput } from "../../components/common/Field"
import MedicineSearchSelect from "../../components/modules/clinical/MedicineSearchSelect"
import { apiRequest } from "../../api/client"
import { useAuth } from "../../context/AuthContext"
import { getAppointmentScheduleError } from "../../utils/appointmentSchedule"

const APPOINTMENT_TYPES = ["General Consultation", "Follow-up", "Emergency", "Routine Check-up"]
const STATUS_TONES = { Scheduled: "blue", "Payment Pending": "amber", "ON GOING": "blue", Completed: "green", Cancelled: "coral", "No Show": "amber" }
const TREATMENT_DURATIONS = { "5 Days": 5, "10 Days": 10, "15 Days": 15, "20 Days": 20 }

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
        treatment_duration: "",
        bp: "",
        pulse: "",
        temperature: "",
        medicines: [emptyMedicine()],
    }
}

function emptyMedicine() {
    return {
        medicine: "",
        medicineId: "",
        frequency: [],
    }
}

const MEDICINE_FREQUENCIES = ["Morning", "Afternoon", "Evening", "Night"]

function getVitalsError({ bp, pulse, temperature }) {
    if (bp && !/^\d+\/\d+$/.test(bp)) return "Blood pressure must use the format 120/80, without spaces or units."
    if (bp) {
        const [systolic, diastolic] = bp.split("/").map(Number)
        if (systolic < 50 || systolic > 300 || diastolic < 30 || diastolic > 200 || systolic <= diastolic) {
            return "Enter a valid blood pressure: systolic 50–300, diastolic 30–200, with systolic higher than diastolic."
        }
    }
    if (pulse && (!/^\d+$/.test(pulse) || Number(pulse) < 20 || Number(pulse) > 250)) {
        return "Pulse must be a whole number between 20 and 250 bpm."
    }
    if (temperature && (!/^\d+(\.\d+)?$/.test(temperature) || Number(temperature) < 25 || Number(temperature) > 45)) {
        return "Temperature must be in Celsius, between 25 and 45°C."
    }
    return ""
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
    const isReception = user?.role === "receptionist" || user?.role === "admin"

    const [appointments, setAppointments] = useState([])
    const [patients, setPatients] = useState([])
    const [doctors, setDoctors] = useState([])
    const [records, setRecords] = useState([])
    const [prescriptions, setPrescriptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState("")

    const [statusFilter, setStatusFilter] = useState("")
    const [query, setQuery] = useState("")

    const [showBooking, setShowBooking] = useState(false)
    const [editingAppointment, setEditingAppointment] = useState(null)
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
            requests.push(isPatient || isDoctor ? apiRequest("/prescriptions?limit=100") : Promise.resolve({ data: [] }))
            const [appointmentResult, doctorResult, patientResult, recordResult, prescriptionResult] = await Promise.all(requests)
            setAppointments(appointmentResult.data)
            setDoctors(doctorResult.data)
            setPatients(patientResult.data)
            setRecords(recordResult.data)
            setPrescriptions(prescriptionResult.data)
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
    const prescriptionByRecord = useMemo(
        () => new Map(prescriptions.map((prescription) => [prescription.medical_record_id, prescription])),
        [prescriptions],
    )
    const patientName = useCallback(
        (patientId) => patients.find((item) => item.patient_id === patientId)?.full_name || patientId,
        [patients],
    )
    const doctorName = useCallback((doctorId) => {
        const match = doctors.find((item) => item.doctor_id === doctorId)
        return match ? `${match.first_name} ${match.last_name}` : doctorId
    }, [doctors])

    const selectedMedicines = useMemo(
        () => recordForm.medicines.filter((item) => item.medicine.trim()),
        [recordForm.medicines],
    )

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
        setEditingAppointment(null)
        setForm({
            ...emptyAppointment(),
            patient_id: isPatient ? user.patient_id || "" : "",
            doctor_id: isDoctor ? user.doctor_id || "" : "",
        })
        setFormError("")
        setShowBooking(true)
    }

    const openEdit = (appointment) => {
        setEditingAppointment(appointment)
        setForm({
            ...emptyAppointment(),
            patient_id: appointment.patient_id,
            doctor_id: appointment.doctor_id,
            appointment_date: String(appointment.appointment_date).slice(0, 10),
            appointment_time: String(appointment.appointment_time).slice(0, 5),
            appointment_type: appointment.appointment_type,
            reason: appointment.reason,
            notes: appointment.notes || "",
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
        const scheduleError = getAppointmentScheduleError(form.appointment_date, form.appointment_time)
        if (scheduleError) {
            setFormError(scheduleError)
            return
        }
        setSaving(true)
        try {
            await apiRequest(editingAppointment ? `/appointments/${editingAppointment.appointment_id}` : "/appointments", {
                method: editingAppointment ? "PUT" : "POST",
                body: JSON.stringify({
                    ...form,
                    appointment_time: form.appointment_time.length === 5
                        ? `${form.appointment_time}:00`
                        : form.appointment_time,
                    notes: form.notes || null,
                }),
            })
            setShowBooking(false)
            setToast(editingAppointment ? "Appointment updated." : "Appointment booked.")
            setEditingAppointment(null)
            await load()
        } catch (error) {
            setFormError(error.message || "Unable to book this appointment.")
        } finally {
            setSaving(false)
        }
    }

    const openConsultation = (appointment, record = recordByAppointment.get(appointment.appointment_id)) => {
        const vitalSigns = record?.vital_signs || {}
        setConsultFor(appointment)
        setRecordForm({
            ...emptyRecord(),
            diagnosis: record?.diagnosis || "",
            symptoms: record?.symptoms || "",
            treatment: record?.treatment || "",
            notes: record?.notes || "",
            bp: vitalSigns.blood_pressure || "",
            pulse: vitalSigns.pulse || "",
            temperature: vitalSigns.temperature || "",
        })
        setRecordError("")
    }

    const submitRecord = async (event) => {
        event.preventDefault()
        setRecordError("")
        const existingRecord = recordByAppointment.get(consultFor?.appointment_id)
        const existingPrescription = existingRecord ? prescriptionByRecord.get(existingRecord.record_id) : null
        if (!existingRecord && (!recordForm.diagnosis.trim() || !recordForm.symptoms.trim())) {
            setRecordError("Diagnosis and symptoms are required.")
            return
        }
        if (existingPrescription) {
            setRecordError("A prescription already exists for this consultation.")
            return
        }
        if (existingRecord && selectedMedicines.length === 0) {
            setRecordError("This consultation is already recorded. Add at least one medicine to create its prescription.")
            return
        }
        const vitalsError = getVitalsError(recordForm)
        if (vitalsError) {
            setRecordError(vitalsError)
            return
        }
        const incompleteMedicine = selectedMedicines.some((item) => (
            !item.medicineId
            || item.frequency.length === 0
        ))
        if (incompleteMedicine) {
            setRecordError("Complete every medicine field or remove the empty medicine entry.")
            return
        }
        if (selectedMedicines.length && !recordForm.treatment_duration) {
            setRecordError("Please select a treatment duration.")
            return
        }
        setSaving(true)
        try {
            const vitals = {}
            if (recordForm.bp) vitals.blood_pressure = recordForm.bp
            if (recordForm.pulse) vitals.pulse = Number(recordForm.pulse)
            if (recordForm.temperature) vitals.temperature = recordForm.temperature
            const createdRecord = existingRecord || await apiRequest("/medical-records", {
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
                }),
            })
            if (selectedMedicines.length) {
                await apiRequest("/prescriptions", {
                    method: "POST",
                    body: JSON.stringify({
                        medical_record_id: createdRecord.record_id,
                        appointment_id: consultFor.appointment_id,
                        patient_id: consultFor.patient_id,
                        doctor_id: user.doctor_id,
                        medicines: selectedMedicines.map((item) => ({
                            medicine_id: item.medicineId,
                            medicine_name: item.medicine.trim(),
                            frequency: item.frequency,
                            duration: recordForm.treatment_duration,
                            number_of_doses: item.frequency.length,
                            prescribed_quantity: TREATMENT_DURATIONS[recordForm.treatment_duration] * item.frequency.length,
                        })),
                    }),
                })
            }
            setConsultFor(null)
            setToast(existingRecord ? "Prescription recorded for the existing consultation." : selectedMedicines.length ? "Consultation and prescription recorded." : "Consultation recorded.")
            await load()
        } catch (error) {
            setRecordError(error.message || "Unable to save this consultation.")
        } finally {
            setSaving(false)
        }
    }

    const updateMedicine = (index, key, value) => {
        setRecordForm((current) => ({
            ...current,
            medicines: current.medicines.map((medicine, currentIndex) => (
                currentIndex === index ? { ...medicine, [key]: value } : medicine
            )),
        }))
    }

    const addMedicine = () => {
        setRecordForm((current) => ({ ...current, medicines: [...current.medicines, emptyMedicine()] }))
    }

    const toggleMedicineFrequency = (index, frequency) => {
        setRecordForm((current) => ({
            ...current,
            medicines: current.medicines.map((medicine, currentIndex) => {
                if (currentIndex !== index) return medicine
                const selected = medicine.frequency.includes(frequency)
                return {
                    ...medicine,
                    frequency: selected
                        ? medicine.frequency.filter((item) => item !== frequency)
                        : [...medicine.frequency, frequency],
                }
            }),
        }))
    }

    const removeMedicine = (index) => {
        setRecordForm((current) => ({
            ...current,
            medicines: current.medicines.filter((_, currentIndex) => currentIndex !== index),
        }))
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

    const markOngoing = async (appointment) => {
        try {
            await apiRequest(`/appointments/${appointment.appointment_id}`, { method: "PUT", body: JSON.stringify({ status: "ON GOING" }) })
            setToast(`${appointment.appointment_id} marked ON GOING.`)
            await load()
        } catch (error) {
            setToast(error.message || "Unable to update appointment status.")
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
                                                    {isReception && appointment.status === "Scheduled" ? (
                                                        <Button variant="subtle" className="px-4 py-1.5 text-xs" onClick={() => markOngoing(appointment)}>
                                                            Mark ON GOING
                                                        </Button>
                                                    ) : null}
                                                    {isReception && ["Scheduled", "Payment Pending", "ON GOING"].includes(appointment.status) ? (
                                                        <Button variant="subtle" className="px-4 py-1.5 text-xs" onClick={() => openEdit(appointment)}>
                                                            Change date/time
                                                        </Button>
                                                    ) : null}
                                                    {isDoctor && !record && ["Scheduled", "ON GOING"].includes(appointment.status) ? (
                                                        <Button
                                                            className="px-4 py-1.5 text-xs"
                                                            onClick={() => openConsultation(appointment)}
                                                        >
                                                            Record consultation
                                                        </Button>
                                                    ) : null}
                                                    {isDoctor && record && !prescriptionByRecord.has(record.record_id) ? (
                                                        <Button
                                                            className="px-4 py-1.5 text-xs"
                                                            onClick={() => openConsultation(appointment, record)}
                                                        >
                                                            Add prescription
                                                        </Button>
                                                    ) : null}
                                                    {record ? <StatusPill tone="green">Record {record.record_id}</StatusPill> : null}
                                                    {record && prescriptionByRecord.has(record.record_id) ? <StatusPill tone="green">Prescription saved</StatusPill> : null}
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

            <Modal open={showBooking} onClose={() => { setShowBooking(false); setEditingAppointment(null) }} title={editingAppointment ? "Change appointment" : "Book an appointment"} eyebrow="Scheduling">
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
                        <p className="mt-1 text-xs text-[var(--muted)]">Sundays are holidays. Saturday timings: 11:00 AM–2:00 PM.</p>
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
                        <Button type="button" variant="subtle" onClick={() => { setShowBooking(false); setEditingAppointment(null) }}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingAppointment ? "Save date/time" : "Confirm booking"}</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={Boolean(consultFor)}
                onClose={() => setConsultFor(null)}
                title={consultFor && recordByAppointment.has(consultFor.appointment_id) ? "Add prescription" : "Record consultation"}
                eyebrow={consultFor ? `${consultFor.appointment_id} · ${patientName(consultFor.patient_id)}` : "Consultation"}
                maxWidthClass="max-w-4xl"
            >
                <form onSubmit={submitRecord} className="grid gap-4 md:grid-cols-2">
                    <Field label="Diagnosis" required className="md:col-span-2">
                        <TextInput readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.diagnosis} onChange={(event) => setRecordForm({ ...recordForm, diagnosis: event.target.value })} />
                    </Field>
                    <Field label="Symptoms" required className="md:col-span-2">
                        <TextInput readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.symptoms} onChange={(event) => setRecordForm({ ...recordForm, symptoms: event.target.value })} />
                    </Field>
                    <Field label="Blood pressure (mmHg)"><TextInput readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.bp} onChange={(event) => setRecordForm({ ...recordForm, bp: event.target.value.replace(/[^\d/]/g, "") })} placeholder="120/80" inputMode="numeric" /></Field>
                    <Field label="Pulse (bpm)"><TextInput readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.pulse} onChange={(event) => setRecordForm({ ...recordForm, pulse: event.target.value.replace(/\D/g, "") })} placeholder="72" inputMode="numeric" /></Field>
                    <Field label="Temperature (°C)"><TextInput readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} type="number" min="25" max="45" step="0.1" value={recordForm.temperature} onChange={(event) => setRecordForm({ ...recordForm, temperature: event.target.value })} placeholder="37.0" /></Field>
                    <Field label="Treatment" className="md:col-span-2">
                        <TextArea readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.treatment} onChange={(event) => setRecordForm({ ...recordForm, treatment: event.target.value })} />
                    </Field>
                    <Field label="Notes" className="md:col-span-2">
                        <TextArea readOnly={Boolean(consultFor && recordByAppointment.has(consultFor.appointment_id))} value={recordForm.notes} onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })} />
                    </Field>
                    <div className="md:col-span-2 rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-[var(--ink)]">Prescription / Medicines</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Optional — add one or more medicines to this consultation</p>
                            </div>
                            <Button type="button" variant="subtle" onClick={addMedicine}>+ Add Medicine</Button>
                        </div>

                        <div className="mt-5 max-w-sm">
                            <Field label="Treatment duration" required>
                                <Select value={recordForm.treatment_duration} onChange={(event) => setRecordForm((current) => ({ ...current, treatment_duration: event.target.value }))}>
                                    <option value="">Select duration</option>
                                    {Object.keys(TREATMENT_DURATIONS).map((duration) => <option key={duration} value={duration}>{duration}</option>)}
                                </Select>
                            </Field>
                        </div>

                        <div className="mt-5 space-y-4">
                        {recordForm.medicines.map((medicine, index) => (
                                <div key={`${index}-${medicine.medicine}`} className="rounded-[22px] border border-[rgba(216,206,193,0.7)] bg-white p-4">
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        <Field label="Medicine" className="md:col-span-2 xl:col-span-3">
                                            <MedicineSearchSelect
                                                value={medicine.medicine}
                                                onSelect={(option) => {
                                                    updateMedicine(index, "medicineId", option.medicine_id)
                                                    updateMedicine(index, "medicine", option.medicine_name)
                                                }}
                                            />
                                        </Field>
                                        <Field label="Frequency" required className="md:col-span-1 xl:col-span-2">
                                            <div className="flex flex-wrap gap-2">
                                                {MEDICINE_FREQUENCIES.map((frequency) => (
                                                    <button
                                                        key={frequency}
                                                        type="button"
                                                        onClick={() => toggleMedicineFrequency(index, frequency)}
                                                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${medicine.frequency.includes(frequency) ? "border-[#9fcceb] bg-[#eaf4fb] text-[var(--ink)]" : "border-[var(--line)] bg-white text-[var(--muted)]"}`}
                                                    >
                                                        {frequency}
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>
                                        <Field label="Doses per day" required className="md:col-span-1 xl:col-span-1">
                                            <TextInput readOnly value={medicine.frequency.length ? String(medicine.frequency.length) : ""} placeholder="Select dosing times" />
                                        </Field>
                                    </div>
                                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                        <Field label="Calculated quantity">
                                            <TextInput readOnly value={recordForm.treatment_duration && medicine.frequency.length ? String(TREATMENT_DURATIONS[recordForm.treatment_duration] * medicine.frequency.length) : ""} placeholder="Calculated automatically" />
                                        </Field>
                                    </div>
                                    {recordForm.medicines.length > 1 ? (
                                        <div className="mt-4 flex justify-end">
                                            <Button type="button" variant="subtle" onClick={() => removeMedicine(index)}>Remove medicine</Button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                    {recordError ? (
                        <p className="md:col-span-2 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{recordError}</p>
                    ) : null}
                    <div className="md:col-span-2 flex justify-end gap-3">
                        <Button type="button" variant="subtle" onClick={() => setConsultFor(null)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Saving…" : consultFor && recordByAppointment.has(consultFor.appointment_id) ? "Save prescription" : "Save consultation"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Appointments
