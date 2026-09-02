import { useCallback, useEffect, useMemo, useState } from "react"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AsyncState from "../../components/common/AsyncState"
import { Select, TextInput } from "../../components/common/Field"
import { apiRequest } from "../../api/client"
import { useAuth } from "../../context/AuthContext"

function formatDate(value) {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
        ? String(value).slice(0, 10)
        : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

/**
 * Clinical record browser.
 *
 * Reads from /medical-records, which the backend already scopes: a patient sees
 * only their own records and a doctor only those they authored.
 */
function MedicalRecords() {
    const { user } = useAuth()
    const isPatient = user?.role === "patient"

    const [records, setRecords] = useState([])
    const [patients, setPatients] = useState([])
    const [prescriptions, setPrescriptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [query, setQuery] = useState("")
    const [patientFilter, setPatientFilter] = useState("")
    const [selected, setSelected] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const [recordResult, patientResult, prescriptionResult] = await Promise.all([
                apiRequest("/medical-records?limit=100"),
                apiRequest("/patients?limit=100").catch(() => ({ data: [] })),
                apiRequest("/prescriptions?limit=100").catch(() => ({ data: [] })),
            ])
            setRecords(recordResult.data)
            setPatients(patientResult.data)
            setPrescriptions(prescriptionResult.data)
        } catch (requestError) {
            setError(requestError.message || "Unable to load medical records.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const patientName = useCallback(
        (patientId) => patients.find((item) => item.patient_id === patientId)?.full_name || patientId,
        [patients],
    )
    const prescriptionFor = useCallback(
        (recordId) => prescriptions.find((item) => item.medical_record_id === recordId),
        [prescriptions],
    )

    const visible = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        return records
            .filter((record) => (patientFilter ? record.patient_id === patientFilter : true))
            .filter((record) => {
                if (!normalized) return true
                return [record.record_id, record.diagnosis, record.symptoms, patientName(record.patient_id)]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(normalized))
            })
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    }, [records, query, patientFilter, patientName])

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Clinical"
                title="Medical Records"
                description={isPatient
                    ? "Every consultation recorded for you, with the prescription that came out of it."
                    : "Consultations you have recorded, searchable by patient, diagnosis, or symptom."}
            />

            <Card className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                    <TextInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by diagnosis, symptom, record ID, or patient"
                        className="sm:flex-1"
                    />
                    {!isPatient ? (
                        <Select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)} className="sm:w-64">
                            <option value="">All patients</option>
                            {patients.map((patient) => (
                                <option key={patient.patient_id} value={patient.patient_id}>{patient.full_name}</option>
                            ))}
                        </Select>
                    ) : null}
                </div>
            </Card>

            <AsyncState
                loading={loading}
                error={error}
                onRetry={load}
                empty={visible.length === 0}
                emptyTitle="No medical records yet"
                emptyHint={isPatient
                    ? "Records appear here once a clinician completes a consultation."
                    : "Record a consultation from the Appointments screen to create the first one."}
            >
                <Card className="min-w-0 p-5">
                    <div className="responsive-table scroll-table -mx-1 min-w-0 overflow-x-auto px-1">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                    <th className="py-3 pr-4">Record</th>
                                    <th className="py-3 pr-4">Patient</th>
                                    <th className="py-3 pr-4">Diagnosis</th>
                                    <th className="py-3 pr-4">Recorded</th>
                                    <th className="py-3">Prescription</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((record) => {
                                    const prescription = prescriptionFor(record.record_id)
                                    return (
                                        <tr
                                            key={record.record_id}
                                            className="cursor-pointer border-t border-[var(--line)] align-top hover:bg-white/50"
                                            onClick={() => setSelected(record)}
                                        >
                                            <td className="py-3 pr-4 font-semibold text-[var(--ink)]" data-label="Record">{record.record_id}</td>
                                            <td className="py-3 pr-4" data-label="Patient">{patientName(record.patient_id)}</td>
                                            <td className="py-3 pr-4" data-label="Diagnosis">
                                                <span className="text-wrap-anywhere">{record.diagnosis}</span>
                                            </td>
                                            <td className="py-3 pr-4" data-label="Recorded">{formatDate(record.created_at)}</td>
                                            <td className="py-3" data-label="Prescription">
                                                {prescription
                                                    ? <StatusPill tone="green">{prescription.prescription_id}</StatusPill>
                                                    : <StatusPill tone="neutral">None</StatusPill>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </AsyncState>

            <Modal
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                title={selected ? `${selected.record_id} · ${patientName(selected.patient_id)}` : "Record"}
                eyebrow="Consultation"
            >
                {selected ? (
                    <div className="space-y-4">
                        {[
                            ["Diagnosis", selected.diagnosis],
                            ["Symptoms", selected.symptoms],
                            ["Treatment", selected.treatment],
                            ["Notes", selected.notes],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
                                <p className="text-wrap-anywhere mt-1 text-sm text-[var(--ink)]">{value || "Not recorded"}</p>
                            </div>
                        ))}
                        {selected.vital_signs && Object.keys(selected.vital_signs).length > 0 ? (
                            <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Vital signs</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {Object.entries(selected.vital_signs).map(([key, value]) => (
                                        <p key={key} className="text-sm text-[var(--ink)]">
                                            <span className="text-[var(--muted)]">{key.replace(/_/g, " ")}:</span> {String(value)}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-2">
                            <p className="text-xs text-[var(--muted)]">Appointment: {selected.appointment_id}</p>
                            <p className="text-xs text-[var(--muted)]">Follow-up: {formatDate(selected.follow_up_date)}</p>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    )
}

export default MedicalRecords
