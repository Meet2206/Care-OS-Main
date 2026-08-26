import { useEffect, useMemo, useRef, useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import BookingCalendar from "../../components/modules/patients/BookingCalendar"
import { useAuth } from "../../context/AuthContext"
import { apiRequest } from "../../api/client"
import {
    doctorReportOptions,
} from "../../data/mockData"

function statusTone(status) {
    if (status === "Confirmed") {
        return "green"
    }

    if (status === "Arrived") {
        return "blue"
    }

    return "amber"
}

function createMedicationRow() {
    return {
        medicine: "",
        medicineId: "",
        tablets: "",
        times: [],
    }
}

function formatDateDisplay(value) {
    if (!value) {
        return "DD/MM/YYYY"
    }

    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year}`
}

function createReviewForm() {
    return {
        improvementStatus: "Stable",
        improvement: "",
        nextVisit: "",
        report: "No report required",
        medicines: [createMedicationRow()],
    }
}

function DoctorDashboard() {
    const { user } = useAuth()
    const appointmentsRef = useRef(null)
    const [query, setQuery] = useState("")
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [saveMessage, setSaveMessage] = useState("")
    const [reviewForm, setReviewForm] = useState(createReviewForm())
    const [patients, setPatients] = useState([])
    const [appointments, setAppointments] = useState([])
    const [records, setRecords] = useState([])
    const [medicineOptions, setMedicineOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState("")
    const [prescriptionError, setPrescriptionError] = useState("")

    useEffect(() => {
        let active = true
        Promise.all([
            apiRequest("/patients?limit=100"),
            apiRequest("/appointments?limit=100"),
            apiRequest("/medical-records?limit=100"),
            apiRequest("/medicines/search?limit=50"),
        ]).then(([patientResult, appointmentResult, recordResult, medicineResult]) => {
            if (!active) return
            setPatients(patientResult.data)
            setAppointments(appointmentResult.data)
            setRecords(recordResult.data)
            setMedicineOptions(medicineResult.data)
        }).catch((error) => {
            if (active) setLoadError(error.message || "Unable to load doctor data.")
        }).finally(() => {
            if (active) setLoading(false)
        })
        return () => { active = false }
    }, [])

    const selectedMedicines = useMemo(
        () => reviewForm.medicines.filter((item) => item.medicine),
        [reviewForm.medicines],
    )

    const filteredPatients = useMemo(() => {
        const normalized = query.trim().toLowerCase()

        if (!normalized) {
            return patients
        }

        return patients.filter((patient) =>
            patient.patient_id.toLowerCase().includes(normalized) || patient.full_name.toLowerCase().includes(normalized),
        )
    }, [query, patients])

    const openReview = (patient) => {
        const patientAppointments = appointments.filter((item) => item.patient_id === patient.patient_id)
        const appointment = patientAppointments.find((item) => records.some((record) => record.appointment_id === item.appointment_id)) || patientAppointments[0]
        const record = appointment ? records.find((item) => item.appointment_id === appointment.appointment_id) : null
        setSelectedPatient(patient)
        setReviewForm({ ...createReviewForm(), appointment, record })
        setSaveMessage("")
        setPrescriptionError("")
    }

    const closeReview = () => {
        setSelectedPatient(null)
        setReviewForm(createReviewForm())
    }

    const updateMedicine = (index, key, value) => {
        setReviewForm((current) => ({
            ...current,
            medicines: current.medicines.map((medicine, currentIndex) =>
                currentIndex === index ? { ...medicine, [key]: value } : medicine,
            ),
        }))
    }

    const toggleMedicineTime = (index, time) => {
        setReviewForm((current) => ({
            ...current,
            medicines: current.medicines.map((medicine, currentIndex) => {
                if (currentIndex !== index) {
                    return medicine
                }

                const nextTimes = medicine.times.includes(time)
                    ? medicine.times.filter((item) => item !== time)
                    : [...medicine.times, time]

                return {
                    ...medicine,
                    times: nextTimes,
                }
            }),
        }))
    }

    const addMedicine = () => {
        setReviewForm((current) => ({
            ...current,
            medicines: [...current.medicines, createMedicationRow()],
        }))
    }

    const removeMedicine = (index) => {
        setReviewForm((current) => ({
            ...current,
            medicines: current.medicines.filter((_, currentIndex) => currentIndex !== index),
        }))
    }

    const saveReview = async (event) => {
        event.preventDefault()
        if (!reviewForm.record || !reviewForm.appointment) {
            setPrescriptionError("A linked appointment and medical record are required before prescribing.")
            return
        }
        const reportsNote = reviewForm.report === "No report required" ? "No report ordered." : `Report requested: ${reviewForm.report}.`
        const medicinesCount = selectedMedicines.length
        if (!medicinesCount) {
            setSaveMessage(`Review saved for ${selectedPatient?.full_name}. ${reportsNote}`)
            return
        }
        try {
            await apiRequest("/prescriptions", {
                method: "POST",
                body: JSON.stringify({
                    medical_record_id: reviewForm.record.record_id,
                    appointment_id: reviewForm.appointment.appointment_id,
                    patient_id: selectedPatient.patient_id,
                    doctor_id: user.doctor_id,
                    medicines: selectedMedicines.map((item) => ({
                        medicine_id: item.medicineId,
                        medicine_name: item.medicine,
                        dosage: `${item.tablets} tablets`,
                        frequency: item.times.join(", "),
                        duration: "As directed",
                        instructions: reviewForm.improvement || null,
                    })),
                }),
            })
        } catch (error) {
            setPrescriptionError(error.message || "Unable to save prescription.")
            return
        }
        setSaveMessage(`Review saved for ${selectedPatient?.full_name}. ${reportsNote} ${medicinesCount} medicine plan item${medicinesCount === 1 ? "" : "s"} added.`)
        closeReview()
    }

    return (
        <>
            <div className="space-y-6">
                <PageIntro
                    eyebrow="Doctor Workflow"
                    title="Patient Management"
                    description="Today’s work stays grouped, readable, and easy to scan under pressure, with no extra chrome getting in the way."
                    actions={(
                        <Button
                            variant="subtle"
                            onClick={() => appointmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                            View Schedule
                        </Button>
                    )}
                />

                {saveMessage ? (
                    <div className="rounded-2xl border border-[#d4e7d9] bg-[#eef8f0] px-4 py-3 text-sm text-[#4c6a56]">
                        {saveMessage}
                    </div>
                ) : null}
                {loadError ? <div className="rounded-2xl border border-[#f0c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{loadError}</div> : null}

                <div ref={appointmentsRef} className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Today&apos;s Appointments</h2>
                        <div className="responsive-table scroll-table mt-5 rounded-[24px] border border-[var(--line)]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--panel-muted)] text-[var(--muted)]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Time</th>
                                        <th className="px-4 py-3 font-semibold">Patient</th>
                                        <th className="px-4 py-3 font-semibold">Reason</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((row) => {
                                        const patient = patients.find((item) => item.patient_id === row.patient_id)
                                        return <tr key={row.appointment_id} className="border-t border-[var(--line)] text-[var(--ink)]">
                                            <td data-label="Time" className="px-4 py-4">{row.appointment_time}</td>
                                            <td data-label="Patient" className="px-4 py-4">{patient?.full_name || row.patient_id}</td>
                                            <td data-label="Reason" className="px-4 py-4 text-[var(--muted)]">{row.reason}</td>
                                            <td data-label="Status" className="px-4 py-4">
                                                <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
                                            </td>
                                        </tr>
                                    })}
                                    {!loading && !appointments.length ? <tr><td colSpan="4" className="px-4 py-6 text-center text-[var(--muted)]">No appointments available.</td></tr> : null}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Patient Alerts</h2>
                        <div className="mt-5 space-y-4">
                            {[
                                ["Critical", "", "coral"],
                                ["High", "", "amber"],
                                ["Normal", "", "blue"],
                            ].map(([label, note, tone]) => (
                                <div key={label} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`h-3 w-3 rounded-full ${tone === "coral" ? "bg-[#f46d61]" : tone === "amber" ? "bg-[#e0b75c]" : "bg-[#2da8b7]"}`} />
                                        <p className="font-semibold text-[var(--ink)]">{label}</p>
                                    </div>
                                    <p className="text-sm text-[var(--muted)]">{note}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <Card className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-display text-3xl text-[var(--ink)]">Assigned Patients</h2>
                            <p className="mt-2 text-sm text-[var(--muted)]">Fast lookup list for bedside rounds and consultation prep.</p>
                        </div>
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm text-[var(--muted)] outline-none"
                            placeholder="Search patients..."
                        />
                    </div>

                    <div className="responsive-table scroll-table mt-5 rounded-[24px] border border-[var(--line)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--panel-muted)] text-[var(--muted)]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Patient ID</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold">Ward / Room</th>
                                    <th className="px-4 py-3 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPatients.map((patient) => (
                                    <tr key={patient.patient_id} className="border-t border-[var(--line)] text-[var(--ink)]">
                                        <td data-label="Patient ID" className="px-4 py-4">{patient.patient_id}</td>
                                        <td data-label="Name" className="px-4 py-4">{patient.full_name}</td>
                                        <td data-label="Ward / Room" className="px-4 py-4 text-[var(--muted)]">{patient.address}</td>
                                        <td data-label="Action" className="px-4 py-4">
                                            <Button variant="subtle" className="px-4 py-2" onClick={() => openReview(patient)}>
                                                Review
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!filteredPatients.length ? (
                                    <tr className="border-t border-[var(--line)] text-[var(--muted)]">
                                        <td colSpan="4" className="px-4 py-6 text-center">No assigned patient matched that search.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <Modal
                open={Boolean(selectedPatient)}
                onClose={closeReview}
                title={selectedPatient ? `Review for ${selectedPatient.full_name}` : "Patient Review"}
                eyebrow="Doctor Review"
                maxWidthClass="max-w-4xl"
            >
                <form onSubmit={saveReview} className="space-y-5">
                    <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                        <div className="mb-5 grid gap-3 rounded-[22px] border border-[rgba(216,206,193,0.7)] bg-white p-4 md:grid-cols-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Patient</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{selectedPatient?.full_name}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Patient ID</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{selectedPatient?.patient_id}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Ward / Room</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{selectedPatient?.address}</p>
                            </div>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Improvement Status</span>
                                    <select
                                        value={reviewForm.improvementStatus}
                                        onChange={(event) => setReviewForm((current) => ({ ...current, improvementStatus: event.target.value }))}
                                        className="w-full appearance-none rounded-[18px] border border-[rgba(181,198,214,0.92)] bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,244,249,0.94))] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                    >
                                        {["Improving", "Stable", "Needs close follow-up", "Escalate review"].map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Improvement / Review</span>
                                    <textarea
                                        value={reviewForm.improvement}
                                        onChange={(event) => setReviewForm((current) => ({ ...current, improvement: event.target.value }))}
                                        className="min-h-[220px] w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                        placeholder="Write progress notes, recovery status, symptoms, and follow-up instructions..."
                                    />
                                </label>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-[22px] border border-[rgba(216,206,193,0.75)] bg-white p-4">
                                    <p className="text-sm font-semibold text-[var(--ink)]">Next Visit</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Select a follow-up day</p>
                                    <div className="mt-3 rounded-[16px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm font-medium text-[var(--ink)]">
                                        {formatDateDisplay(reviewForm.nextVisit)}
                                    </div>
                                    <div className="mt-4">
                                        <BookingCalendar
                                            value={reviewForm.nextVisit}
                                            onChange={(value) => setReviewForm((current) => ({ ...current, nextVisit: value }))}
                                        />
                                    </div>
                                </div>

                                <label className="block rounded-[22px] border border-[rgba(216,206,193,0.75)] bg-white p-4">
                                    <span className="block text-sm font-semibold text-[var(--ink)]">Report</span>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Leave as “No report required” when no investigation is needed.</p>
                                    <select
                                        value={reviewForm.report}
                                        onChange={(event) => setReviewForm((current) => ({ ...current, report: event.target.value }))}
                                        className="mt-3 w-full appearance-none rounded-[18px] border border-[rgba(181,198,214,0.92)] bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,244,249,0.94))] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                    >
                                        {doctorReportOptions.map((report) => (
                                            <option key={report} value={report}>{report}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Medication Box</p>
                                <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Medicine Plan</h3>
                                <p className="mt-2 text-sm text-[var(--muted)]">Medicine choices are kept aligned to the logged-in doctor profile so the form feels closer to a real prescription desk.</p>
                            </div>
                            <Button type="button" variant="subtle" onClick={addMedicine}>Add Medicine</Button>
                        </div>

                        <div className="mt-5 space-y-4">
                            {reviewForm.medicines.map((medicine, index) => (
                                <div key={`${index}-${medicine.medicine}`} className="rounded-[22px] border border-[rgba(216,206,193,0.7)] bg-white p-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Medicine</span>
                                            <select
                                                value={medicine.medicineId}
                                                onChange={(event) => {
                                                    const option = medicineOptions.find((item) => item.medicine_id === event.target.value)
                                                    updateMedicine(index, "medicineId", option?.medicine_id || "")
                                                    updateMedicine(index, "medicine", option?.medicine_name || "")
                                                }}
                                                className="w-full appearance-none rounded-[16px] border border-[rgba(181,198,214,0.92)] bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,244,249,0.94))] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                            >
                                                <option value="">Select medicine</option>
                                                {medicineOptions.map((option) => (
                                                    <option key={option.medicine_id} value={option.medicine_id}>{option.medicine_name}</option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">No. of Tablets</span>
                                            <select
                                                value={medicine.tablets}
                                                onChange={(event) => updateMedicine(index, "tablets", event.target.value)}
                                                className="w-full appearance-none rounded-[16px] border border-[rgba(181,198,214,0.92)] bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,244,249,0.94))] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                            >
                                                <option value="">Select quantity</option>
                                                {["5", "10", "15", "20"].map((count) => (
                                                    <option key={count} value={count}>{count}</option>
                                                ))}
                                            </select>
                                        </label>

                                        <div className="rounded-[16px] border border-[rgba(216,206,193,0.72)] bg-[var(--panel-muted)] px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Timing Plan</p>
                                            <p className="mt-2 text-sm text-[var(--ink)]">Use the time boxes below for once, twice, or thrice daily instructions.</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-[18px] border border-[rgba(216,206,193,0.68)] bg-[rgba(247,242,235,0.82)] p-4">
                                        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">When to take</p>
                                        <div className="flex flex-wrap gap-3">
                                            {["Morning", "Afternoon", "Evening"].map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => toggleMedicineTime(index, time)}
                                                    className={`rounded-full border px-4 py-2 text-sm ${
                                                        medicine.times.includes(time)
                                                            ? "border-[#9fcceb] bg-[#eaf4fb] text-[var(--ink)]"
                                                            : "border-[var(--line)] bg-white text-[var(--muted)]"
                                                    }`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {reviewForm.medicines.length > 1 ? (
                                        <div className="mt-4 flex justify-end">
                                            <Button type="button" variant="subtle" onClick={() => removeMedicine(index)}>
                                                Remove
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Review Summary</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-[18px] border border-[rgba(216,206,193,0.7)] bg-white px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Status</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{reviewForm.improvementStatus}</p>
                            </div>
                            <div className="rounded-[18px] border border-[rgba(216,206,193,0.7)] bg-white px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Next Visit</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{formatDateDisplay(reviewForm.nextVisit)}</p>
                            </div>
                            <div className="rounded-[18px] border border-[rgba(216,206,193,0.7)] bg-white px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Report</p>
                                <p className="mt-2 font-semibold text-[var(--ink)]">{reviewForm.report}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button type="button" variant="subtle" onClick={closeReview}>Cancel</Button>
                        {prescriptionError ? <p className="text-sm text-[#9b5148]">{prescriptionError}</p> : null}
                        <Button type="submit" className="px-6">Save Review</Button>
                    </div>
                </form>
            </Modal>
        </>
    )
}

export default DoctorDashboard
