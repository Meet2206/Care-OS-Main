import { useCallback, useEffect, useMemo, useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AsyncState from "../../components/common/AsyncState"
import Field, { Select, TextInput } from "../../components/common/Field"
import { useAuth } from "../../context/AuthContext"
import { apiRequest } from "../../api/client"

const GUIDANCE_DISCLAIMER =
    "This is general self-care guidance, not medical advice. Contact your care team if symptoms persist or worsen."

const SELF_CARE = {
    headache: {
        title: "Headache",
        advice: [
            "Rest in a quiet, dimly lit room and reduce screen time.",
            "Drink water steadily in case dehydration is contributing.",
            "Eat something light if it has been several hours since your last meal.",
        ],
    },
    cough: {
        title: "Mild cough",
        advice: [
            "Sip warm fluids through the day.",
            "Avoid cold drinks, smoke, and dusty environments.",
            "Rest, and watch for the cough becoming more frequent or painful.",
        ],
    },
    sneezing: {
        title: "Mild sneezing",
        advice: [
            "Avoid dust, strong fragrance, and other triggers you notice.",
            "Rinse your face with clean water and stay hydrated.",
            "Watch for congestion or fever developing alongside it.",
        ],
    },
    sore_throat: {
        title: "Sore throat",
        advice: [
            "Gargle with warm water if that is comfortable.",
            "Drink warm fluids and avoid very cold or spiced food.",
            "Rest your voice and watch for pain or difficulty swallowing.",
        ],
    },
}

function ageFrom(dateOfBirth) {
    if (!dateOfBirth) return null
    const born = new Date(dateOfBirth)
    if (Number.isNaN(born.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - born.getFullYear()
    const monthDelta = today.getMonth() - born.getMonth()
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1
    return Math.max(0, age)
}

function daysSince(dateValue) {
    if (!dateValue) return null
    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) return null
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000))
}

function formatClinicalDate(value) {
    if (!value) return "Date unavailable"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
        ? String(value).slice(0, 10)
        : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

/**
 * CareAI decision support.
 *
 * Both models one-hot encode their categorical inputs with handle_unknown="ignore",
 * so any value outside the training vocabulary is silently dropped and the
 * prediction quietly stops depending on it. The form therefore renders choices
 * fetched from /ai/schema rather than free-text boxes, and the backend rejects
 * anything outside that vocabulary instead of returning a hollow answer.
 */
function CareAI() {
    const { user } = useAuth()
    const isPatient = user?.role === "patient"
    const isDoctor = user?.role === "doctor"
    const isReceptionist = user?.role === "receptionist"

    const [schema, setSchema] = useState(null)
    const [schemaError, setSchemaError] = useState("")
    const [loading, setLoading] = useState(true)

    const [patients, setPatients] = useState([])
    const [appointments, setAppointments] = useState([])
    const [records, setRecords] = useState([])
    const [prescriptions, setPrescriptions] = useState([])
    const [contextError, setContextError] = useState("")

    const [patientId, setPatientId] = useState("")
    const [inputs, setInputs] = useState({
        Disease: "", Severity: "3", Abnormal_Result: "", Diagnosis: "", Symptoms: "",
        Symptom_Count: "1", Chronic_Condition: "", Severity_Score: "3",
    })
    const [result, setResult] = useState(null)
    const [predicting, setPredicting] = useState(false)
    const [predictError, setPredictError] = useState("")
    const [selectedSymptom, setSelectedSymptom] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        setSchemaError("")
        setContextError("")
        try {
            // A patient may read only their own record, so the staff-wide patient
            // list is not requested for them.
            const patientRequest = isPatient
                ? apiRequest(`/patients/${user.patient_id}`).then((one) => ({ data: [one] }))
                : apiRequest("/patients?limit=100")
            const recordRequest = isDoctor || isPatient
                ? apiRequest("/medical-records?limit=100")
                : Promise.resolve({ data: [] })
            const prescriptionRequest = isDoctor || isPatient
                ? apiRequest("/prescriptions?limit=100")
                : Promise.resolve({ data: [] })
            const [schemaResult, patientResult, appointmentResult, recordResult, prescriptionResult] = await Promise.all([
                apiRequest("/ai/schema"),
                patientRequest,
                apiRequest("/appointments?limit=100"),
                recordRequest,
                prescriptionRequest,
            ])
            setSchema(schemaResult)
            setPatients(patientResult.data)
            setAppointments(appointmentResult.data)
            setRecords(recordResult.data)
            setPrescriptions(prescriptionResult.data)
            if (isPatient && user.patient_id) setPatientId(user.patient_id)
        } catch (error) {
            if (error.status === 503) setSchemaError("CareAI is temporarily unavailable. The prediction models could not be loaded.")
            else setContextError(error.message || "Unable to load your clinical context.")
        } finally {
            setLoading(false)
        }
    }, [isDoctor, isPatient, user?.patient_id])

    useEffect(() => { load() }, [load])

    const selectedPatient = patients.find((item) => item.patient_id === patientId)
    const selectedPatientRecords = useMemo(
        () => records
            .filter((record) => record.patient_id === patientId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        [records, patientId],
    )
    const prescriptionsByRecord = useMemo(
        () => new Map(prescriptions.map((prescription) => [prescription.medical_record_id, prescription])),
        [prescriptions],
    )
    const patientAppointments = useMemo(
        () => appointments.filter((item) => item.patient_id === patientId),
        [appointments, patientId],
    )
    const latestAppointment = useMemo(
        () => patientAppointments.slice().sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date)))[0],
        [patientAppointments],
    )
    const age = ageFrom(selectedPatient?.date_of_birth)
    const sinceLastVisit = daysSince(latestAppointment?.appointment_date)

    const priorityVocab = schema?.patient_priority?.categorical || {}
    const waitVocab = schema?.wait_time?.categorical || {}
    const severityBounds = schema?.patient_priority?.numeric?.Severity || { minimum: 1, maximum: 5 }

    const setInput = (key, value) => setInputs((current) => ({ ...current, [key]: value }))

    const selectPatient = (nextPatientId) => {
        setPatientId(nextPatientId)
        setResult(null)
        setPredictError("")
    }

    const runPrediction = async (kind) => {
        setPredicting(true)
        setPredictError("")
        setResult(null)
        try {
            if (!patientId || !selectedPatient) throw new Error("Select a patient first.")
            if (age === null) throw new Error("This patient has no date of birth recorded, so age cannot be derived.")
            const shared = {
                patient_id: patientId,
                Gender: selectedPatient.gender,
                Age: age,
                Number_of_Visits: patientAppointments.length,
            }
            const payload = kind === "priority"
                ? {
                    ...shared,
                    Disease: inputs.Disease,
                    Severity: Number(inputs.Severity),
                    Abnormal_Result: inputs.Abnormal_Result,
                    Diagnosis: inputs.Diagnosis,
                    Symptoms: inputs.Symptoms,
                    Days_Since_Last_Visit: sinceLastVisit ?? 0,
                }
                : {
                    ...shared,
                    Disease: inputs.Disease,
                    Abnormal_Result: inputs.Abnormal_Result_Wait,
                    Symptom_Count: Number(inputs.Symptom_Count),
                    Chronic_Condition: inputs.Chronic_Condition,
                    Severity_Score: Number(inputs.Severity_Score),
                }
            const data = await apiRequest(`/ai/${kind === "priority" ? "patient-priority" : "wait-time"}`, {
                method: "POST",
                body: JSON.stringify(payload),
            })
            setResult({ kind, data })
        } catch (error) {
            setPredictError(error.message || "The AI request could not be completed.")
        } finally {
            setPredicting(false)
        }
    }

    const canPredict = Boolean(patientId && selectedPatient && schema)

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Quadrant 3"
                title="CareAI"
                description="Operational decision support for triage priority and expected waiting time. Advisory only — never a diagnosis."
            />

            {contextError ? (
                <Card className="p-5">
                    <p className="text-sm text-[#9b5148]">{contextError}</p>
                </Card>
            ) : null}

            <AsyncState loading={loading} error={schemaError} onRetry={load} empty={false}>
                <div className="space-y-6">
                    <Card className="min-w-0 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="font-display text-2xl text-[var(--ink)]">Clinical decision support</h2>
                                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                    Age, visit count, and days since last visit come from CareOS. The fields below are the
                                    model&apos;s own vocabulary — only these values carry signal.
                                </p>
                            </div>
                            <StatusPill tone="amber">Advisory only</StatusPill>
                        </div>

                        <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <Field label="Patient" required className="md:col-span-2 xl:col-span-1">
                                {isPatient ? (
                                    <TextInput readOnly value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.patient_id})` : "Loading…"} />
                                ) : (
                                    <Select value={patientId} onChange={(event) => selectPatient(event.target.value)}>
                                        <option value="">Select a patient</option>
                                        {patients.map((patient) => (
                                            <option key={patient.patient_id} value={patient.patient_id}>
                                                {patient.full_name} ({patient.patient_id})
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </Field>
                            <Field label="Disease" required>
                                <Select value={inputs.Disease} onChange={(event) => setInput("Disease", event.target.value)}>
                                    <option value="">Select</option>
                                    {(priorityVocab.Disease || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                </Select>
                            </Field>
                            <Field label="Severity" required hint={`Trained range ${severityBounds.minimum}–${severityBounds.maximum}`}>
                                <Select
                                    value={inputs.Severity}
                                    onChange={(event) => { setInput("Severity", event.target.value); setInput("Severity_Score", event.target.value) }}
                                >
                                    {Array.from(
                                        { length: severityBounds.maximum - severityBounds.minimum + 1 },
                                        (_, index) => severityBounds.minimum + index,
                                    ).map((value) => <option key={value} value={String(value)}>{value}</option>)}
                                </Select>
                            </Field>
                        </div>

                        <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-2">
                            <div className="min-w-0 rounded-2xl bg-[var(--panel-muted)] p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Triage priority inputs</p>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <Field label="Diagnosis" required>
                                        <Select value={inputs.Diagnosis} onChange={(event) => setInput("Diagnosis", event.target.value)}>
                                            <option value="">Select</option>
                                            {(priorityVocab.Diagnosis || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Primary symptom" required>
                                        <Select value={inputs.Symptoms} onChange={(event) => setInput("Symptoms", event.target.value)}>
                                            <option value="">Select</option>
                                            {(priorityVocab.Symptoms || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Result grade" required className="sm:col-span-2">
                                        <Select value={inputs.Abnormal_Result} onChange={(event) => setInput("Abnormal_Result", event.target.value)}>
                                            <option value="">Select</option>
                                            {(priorityVocab.Abnormal_Result || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                        </Select>
                                    </Field>
                                </div>
                                <Button className="mt-4 w-full" onClick={() => runPrediction("priority")} disabled={predicting || !canPredict}>
                                    {predicting ? "Predicting…" : "Predict Priority"}
                                </Button>
                            </div>

                            <div className="min-w-0 rounded-2xl bg-[var(--panel-muted)] p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Waiting time inputs</p>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <Field label="Abnormal result" required hint="This model uses Yes/No">
                                        <Select value={inputs.Abnormal_Result_Wait || ""} onChange={(event) => setInput("Abnormal_Result_Wait", event.target.value)}>
                                            <option value="">Select</option>
                                            {(waitVocab.Abnormal_Result || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Chronic condition" required>
                                        <Select value={inputs.Chronic_Condition} onChange={(event) => setInput("Chronic_Condition", event.target.value)}>
                                            <option value="">Select</option>
                                            {(waitVocab.Chronic_Condition || []).map((value) => <option key={value} value={value}>{value}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Symptom count" required className="sm:col-span-2">
                                        <TextInput
                                            type="number" min="0" max="20"
                                            value={inputs.Symptom_Count}
                                            onChange={(event) => {
                                                const value = event.target.value
                                                setInput("Symptom_Count", value === "" ? "" : String(Math.min(20, Math.max(0, Number(value)))))
                                            }}
                                        />
                                    </Field>
                                </div>
                                <Button variant="subtle" className="mt-4 w-full" onClick={() => runPrediction("wait")} disabled={predicting || !canPredict}>
                                    {predicting ? "Estimating…" : "Estimate Wait Time"}
                                </Button>
                            </div>
                        </div>

                        {selectedPatient ? (
                            <p className="mt-4 text-xs text-[var(--muted)]">
                                From CareOS: age {age ?? "unknown"} · {patientAppointments.length} recorded visit
                                {patientAppointments.length === 1 ? "" : "s"} · {sinceLastVisit ?? "no"} day
                                {sinceLastVisit === 1 ? "" : "s"} since last visit
                                {records.filter((item) => item.patient_id === patientId).length
                                    ? ` · ${records.filter((item) => item.patient_id === patientId).length} clinical record(s)`
                                    : ""}
                            </p>
                        ) : null}

                        {predictError ? (
                            <p className="text-wrap-anywhere mt-4 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{predictError}</p>
                        ) : null}

                        {isDoctor && selectedPatient ? (
                            <div className="mt-6 rounded-2xl border border-[rgba(216,206,193,0.8)] bg-[rgba(247,242,235,0.92)] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Patient context</p>
                                        <h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Previous consultations</h3>
                                    </div>
                                    <StatusPill tone="blue">Read-only history</StatusPill>
                                </div>
                                {selectedPatientRecords.length ? (
                                    <div className="mt-4 space-y-4">
                                        {selectedPatientRecords.map((record) => {
                                            const prescription = prescriptionsByRecord.get(record.record_id)
                                            return (
                                                <article key={record.record_id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{record.record_id} · {formatClinicalDate(record.created_at)}</p>
                                                            <h4 className="mt-2 text-base font-semibold text-[var(--ink)]">{record.diagnosis}</h4>
                                                        </div>
                                                        <span className="text-xs text-[var(--muted)]">Appointment {record.appointment_id}</span>
                                                    </div>
                                                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                                                        <div><span className="font-semibold text-[var(--ink)]">Symptoms:</span> {record.symptoms || "—"}</div>
                                                        <div><span className="font-semibold text-[var(--ink)]">Treatment:</span> {record.treatment || "—"}</div>
                                                        <div><span className="font-semibold text-[var(--ink)]">Notes:</span> {record.notes || "—"}</div>
                                                        <div><span className="font-semibold text-[var(--ink)]">Vitals:</span> {record.vital_signs?.blood_pressure || "—"} BP · {record.vital_signs?.pulse ?? "—"} bpm{record.vital_signs?.temperature != null ? ` · ${record.vital_signs.temperature}°C` : ""}</div>
                                                    </div>
                                                    {prescription?.medicines?.length ? (
                                                        <div className="mt-4 rounded-xl bg-[var(--panel-muted)] p-3">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Prescription</p>
                                                            <div className="mt-2 space-y-2 text-sm text-[var(--ink)]">
                                                                {prescription.medicines.map((medicine) => (
                                                                    <div key={`${prescription.prescription_id}-${medicine.medicine_id}`}>
                                                                        <span className="font-semibold">{medicine.medicine_name}</span>
                                                                        {Array.isArray(medicine.frequency) ? ` · ${medicine.frequency.join(", ")}` : ` · ${medicine.frequency}`}
                                                                        {medicine.duration ? ` · ${medicine.duration}` : ""}
                                                                        {medicine.prescribed_quantity ? ` · Qty ${medicine.prescribed_quantity}` : ""}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="mt-3 text-sm text-[var(--muted)]">No prescription recorded for this consultation.</p>
                                                    )}
                                                </article>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-[var(--muted)]">No previous consultation records found for this patient.</p>
                                )}
                            </div>
                        ) : null}

                        {result ? (
                            <div className="mt-4 rounded-2xl border border-[#cfe0ef] bg-[#f2f8fd] px-4 py-4">
                                {result.kind === "priority" ? (
                                    <>
                                        <p className="font-display text-2xl text-[var(--ink)]">Priority level {result.data.prediction}</p>
                                        <div className="mt-3 space-y-2">
                                            {Object.entries(result.data.probabilities).map(([label, value]) => (
                                                <div key={label} className="flex items-center gap-3">
                                                    <span className="w-16 shrink-0 text-xs text-[var(--muted)]">Level {label}</span>
                                                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                                                        <span className="block h-full rounded-full bg-[var(--primary-blue)]" style={{ width: `${Math.round(value * 100)}%` }} />
                                                    </span>
                                                    <span className="w-14 shrink-0 text-right text-xs font-semibold text-[var(--ink)]">{(value * 100).toFixed(1)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="font-display text-2xl text-[var(--ink)]">
                                        Estimated wait: {result.data.estimated_wait_time.toFixed(0)} minutes
                                    </p>
                                )}
                                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{result.data.advisory}</p>
                            </div>
                        ) : null}
                    </Card>

                    {isPatient ? (
                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">Self-care guidance</h2>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                General suggestions for mild symptoms. Not a substitute for seeing a clinician.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {Object.entries(SELF_CARE).map(([key, item]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedSymptom(key)}
                                        className={`rounded-full border px-4 py-2 text-sm font-medium ${
                                            selectedSymptom === key
                                                ? "border-[#b9d7eb] bg-[#e8f3fb] text-[var(--ink)]"
                                                : "border-[var(--line)] bg-[var(--panel-muted)] text-[var(--muted)]"
                                        }`}
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                            {selectedSymptom ? (
                                <div className="mt-5 rounded-2xl bg-[var(--panel-muted)] p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="font-display text-xl text-[var(--ink)]">{SELF_CARE[selectedSymptom].title}</h3>
                                        <StatusPill tone="amber">General guidance only</StatusPill>
                                    </div>
                                    <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                                        {SELF_CARE[selectedSymptom].advice.map((line) => (
                                            <li key={line} className="rounded-2xl bg-white px-4 py-3">{line}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-4 text-sm leading-7 text-[#8a5d3d]">{GUIDANCE_DISCLAIMER}</p>
                                </div>
                            ) : null}
                        </Card>
                    ) : null}

                    {isDoctor || isReceptionist ? (
                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">How these models behave</h2>
                            <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
                                <li>Severity dominates both models; the categorical fields refine the estimate but do not drive it.</li>
                                <li>Values outside the lists above are rejected rather than silently ignored, so a prediction always reflects what you entered.</li>
                                <li>Output is an operational triage aid. It is not a diagnosis and must not replace clinical judgement.</li>
                            </ul>
                        </Card>
                    ) : null}
                </div>
            </AsyncState>
        </div>
    )
}

export default CareAI
