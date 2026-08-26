import { useEffect, useMemo, useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import { useAuth } from "../../context/AuthContext"
import { apiRequest } from "../../api/client"

const disclaimer =
    "Please consider consulting a doctor. This guidance is only a general suggestion and should not replace professional medical advice."

const appointmentQuestions = [
    { key: "department", label: "Department", placeholder: "Cardiology, General Medicine, ENT..." },
    { key: "doctor", label: "Preferred doctor", placeholder: "Enter doctor name or leave flexible" },
    { key: "date", label: "Preferred date", placeholder: "Select preferred date" },
    { key: "time", label: "Preferred time", placeholder: "Morning / Afternoon / Specific time" },
    { key: "reason", label: "Reason for visit", placeholder: "Describe what you need help with" },
    { key: "mode", label: "Visit type", placeholder: "In-person / Follow-up / Consultation" },
]

const symptomGuidance = {
    headache: {
        title: "Headache",
        advice: [
            "Rest in a quiet room and reduce screen exposure for a while.",
            "Drink water slowly and regularly in case dehydration is contributing.",
            "Have a light meal if you have not eaten for several hours.",
        ],
    },
    cough: {
        title: "Mild cough",
        advice: [
            "Sip warm water or warm fluids through the day.",
            "Avoid cold drinks, smoke exposure, and dusty environments.",
            "Take rest and monitor whether the cough becomes more frequent or painful.",
        ],
    },
    sneezing: {
        title: "Mild sneezing",
        advice: [
            "Avoid dust, perfume, or other possible irritants if you notice a trigger.",
            "Use clean water to gently rinse the face and stay hydrated.",
            "Rest and monitor whether congestion or fever develops alongside the sneezing.",
        ],
    },
    sore_throat: {
        title: "Sore throat",
        advice: [
            "Use warm water for gentle gargling if comfortable.",
            "Drink warm fluids and avoid very cold or irritating foods.",
            "Rest your voice and monitor for increasing pain or difficulty swallowing.",
        ],
    },
}

function CareAI() {
    const { user } = useAuth()
    const isPatient = user?.role === "patient"
    const isDoctor = user?.role === "doctor"
    const isReceptionist = user?.role === "receptionist"
    const isAdmin = user?.role === "admin"

    const [messages, setMessages] = useState(() => {
        if (isDoctor) {
            return [
                {
                    id: 1,
                    sender: "ai",
                    text: "Welcome to CareOS. I'm your Mitra.",
                },
                {
                    id: 2,
                    sender: "ai",
                    text: "Doctor mode is active. Enter a patient name or unique ID and I will help you find their record summary.",
                },
            ]
        }

        if (isAdmin) {
            return [
                {
                    id: 1,
                    sender: "ai",
                    text: "Welcome to CareOS. I'm your Mitra.",
                },
                {
                    id: 2,
                    sender: "ai",
                    text: "Mitra's guided care flow is available in the patient workspace. For doctors, Mitra works as a patient finder.",
                },
            ]
        }

        return [
            {
                id: 1,
                sender: "ai",
                text: "Welcome to CareOS. I'm your Mitra.",
            },
            {
                id: 2,
                sender: "ai",
                text: "How can I help you today? You can register a new patient or get general guidance for a minor health concern.",
            },
        ]
    })
    const [draft, setDraft] = useState("")
    const [mode, setMode] = useState("home")
    const [selectedSymptom, setSelectedSymptom] = useState("")
    const [finderQuery, setFinderQuery] = useState("")
    const [finderResult, setFinderResult] = useState(null)
    const [showContext, setShowContext] = useState(false)
    const [formValues, setFormValues] = useState({
        department: "",
        doctor: "",
        date: "",
        time: "",
        reason: "",
        mode: "",
    })
    const [clinicalPatients, setClinicalPatients] = useState([])
    const [clinicalAppointments, setClinicalAppointments] = useState([])
    const [clinicalRecords, setClinicalRecords] = useState([])
    const [aiPatientId, setAiPatientId] = useState(user?.patient_id || "")
    const [aiInputs, setAiInputs] = useState({ disease: "", severity: "", abnormal: "", chronic: "", symptomCount: "" })
    const [aiResult, setAiResult] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState("")

    useEffect(() => {
        if (!isDoctor && !isPatient && !isReceptionist) return
        const recordRequest = isDoctor || isPatient ? apiRequest("/medical-records?limit=100") : Promise.resolve({ data: [] })
        Promise.all([apiRequest("/patients?limit=100"), apiRequest("/appointments?limit=100"), recordRequest])
            .then(([p, a, r]) => { setClinicalPatients(p.data); setClinicalAppointments(a.data); setClinicalRecords(r.data) })
            .catch((error) => setAiError(error.message || "Unable to load clinical context."))
    }, [isDoctor, isPatient, isReceptionist])

    const selectedClinicalPatient = clinicalPatients.find((patient) => patient.patient_id === aiPatientId)
    const selectedClinicalRecords = clinicalRecords.filter((record) => record.patient_id === aiPatientId)
    const selectedClinicalAppointments = clinicalAppointments.filter((appointment) => appointment.patient_id === aiPatientId)
    const latestRecord = selectedClinicalRecords[0]
    const latestAppointment = selectedClinicalAppointments.slice().sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date)))[0]
    const age = selectedClinicalPatient?.date_of_birth ? Math.max(0, new Date().getFullYear() - new Date(selectedClinicalPatient.date_of_birth).getFullYear()) : null
    const daysSinceLastVisit = latestAppointment?.appointment_date ? Math.max(0, Math.floor((Date.now() - new Date(latestAppointment.appointment_date).getTime()) / 86400000)) : null

    const runPrediction = async (kind) => {
        setAiLoading(true); setAiError(""); setAiResult(null)
        try {
            if (!aiPatientId || !selectedClinicalPatient || !latestRecord || age === null || daysSinceLastVisit === null) throw new Error("Select a patient with a linked medical record and appointment.")
            const common = { patient_id: aiPatientId, Disease: aiInputs.disease, Gender: selectedClinicalPatient.gender, Age: age, Number_of_Visits: selectedClinicalAppointments.length, Abnormal_Result: aiInputs.abnormal }
            const payload = kind === "priority"
                ? { ...common, Severity: Number(aiInputs.severity), Diagnosis: latestRecord.diagnosis, Symptoms: latestRecord.symptoms, Days_Since_Last_Visit: daysSinceLastVisit }
                : { ...common, Symptom_Count: Number(aiInputs.symptomCount), Chronic_Condition: aiInputs.chronic, Severity_Score: Number(aiInputs.severity) }
            setAiResult({ kind, data: await apiRequest(`/ai/${kind === "priority" ? "patient-priority" : "wait-time"}`, { method: "POST", body: JSON.stringify(payload) }) })
        } catch (error) { setAiError(error.message || "The AI request could not be completed.") } finally { setAiLoading(false) }
    }

    const selectedGuidance = useMemo(() => {
        if (!selectedSymptom) {
            return null
        }

        return symptomGuidance[selectedSymptom]
    }, [selectedSymptom])

    const appendMessage = (sender, text) => {
        setMessages((current) => [...current, { id: Date.now() + Math.random(), sender, text }])
    }

    const searchPatient = (query) => {
        const normalizedQuery = query.trim().toLowerCase()

        if (!normalizedQuery) {
            return null
        }

        return clinicalPatients.find((patient) =>
            patient.patient_id.toLowerCase() === normalizedQuery || patient.full_name.toLowerCase().includes(normalizedQuery),
        )
    }

    const handleStartBooking = () => {
        setMode("book-appointment")
        appendMessage("user", "I want to book an appointment.")
        appendMessage("ai", "Sure. Please enter your appointment preferences below and I will prepare a booking request summary.")
    }

    const handleStartGuidance = () => {
        setMode("guidance")
        appendMessage("user", "I need minor health guidance.")
        appendMessage("ai", "Choose a common symptom below and I will share general home-care suggestions.")
    }

    const handleSelectSymptom = (symptomKey) => {
        const guidance = symptomGuidance[symptomKey]
        setSelectedSymptom(symptomKey)
        appendMessage("user", `Help me with ${guidance.title.toLowerCase()}.`)
        appendMessage(
            "ai",
            `${guidance.title}: ${guidance.advice.join(" ")} ${disclaimer}`,
        )
    }

    const handleDoctorFinder = (event) => {
        event.preventDefault()

        const match = searchPatient(finderQuery)
        appendMessage("user", finderQuery.trim())

        if (!match) {
            setFinderResult(null)
            appendMessage("ai", "I could not find that patient. Try a full name or a unique ID such as P001.")
            return
        }

        setFinderResult(match)
        const visits = clinicalAppointments.filter((item) => item.patient_id === match.patient_id)
        const records = clinicalRecords.filter((item) => item.patient_id === match.patient_id)
        setFinderResult({ ...match, visits, records })
        appendMessage("ai", `I found ${match.full_name} (${match.patient_id}). I loaded ${visits.length} appointment(s) and ${records.length} medical record(s) from the backend.`)
        setFinderQuery("")
    }

    const handlePatientFormChange = (key, value) => {
        setFormValues((current) => ({
            ...current,
            [key]: value,
        }))
    }

    const handleAppointmentSubmit = (event) => {
        event.preventDefault()

        const summary = `Appointment request: ${formValues.department} department, preferred doctor ${formValues.doctor || "flexible"}, preferred date ${formValues.date}, time ${formValues.time}, visit type ${formValues.mode}, reason: ${formValues.reason}.`

        appendMessage("user", summary)
        appendMessage(
            "ai",
            "Your appointment request summary is ready. Please review it and confirm with the hospital desk or online booking flow when available.",
        )
        setFormValues({
            department: "",
            doctor: "",
            date: "",
            time: "",
            reason: "",
            mode: "",
        })
    }

    const handleSend = (event) => {
        event.preventDefault()

        if (!draft.trim()) {
            return
        }

        const question = draft.trim()
        appendMessage("user", question)
        appendMessage("ai", isDoctor ? "Mitra noted your follow-up. Use patient search for direct lookup or continue with clinical context questions." : "Mitra noted that request. For medical concerns, please follow the guidance carefully and consult a doctor when needed.")
        setDraft("")
    }

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Quadrant 3"
                title="CareAI"
                description={
                    isDoctor
                        ? "Doctor mode turns Mitra into a focused patient finder so clinicians can jump to a person record quickly by name or unique ID."
                        : "A quiet chat surface prepared for future AI support, designed to assist clinical work without turning itself into the main event."
                }
                actions={<Button variant="subtle" onClick={() => setShowContext((current) => !current)}>{showContext ? "Hide Context" : "Open Context"}</Button>}
            />

            {showContext ? (
                <Card className="p-5">
                    <h3 className="font-display text-2xl text-[var(--ink)]">Current Mitra Context</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Role</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{user?.role}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Mode</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{isDoctor ? "Patient finder" : isPatient ? mode : "Info only"}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Messages</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{messages.length} items</p>
                        </div>
                    </div>
                </Card>
            ) : null}

            {(isDoctor || isPatient) ? (
                <Card className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="font-display text-2xl text-[var(--ink)]">Clinical decision support</h3>
                            <p className="mt-2 text-sm text-[var(--muted)]">Uses your authorized CARE-OS clinical context. Results are advisory and are not diagnoses.</p>
                        </div>
                        <StatusPill tone="amber">Advisory only</StatusPill>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {isDoctor ? <select value={aiPatientId} onChange={(event) => setAiPatientId(event.target.value)} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)]"><option value="">Select authorized patient</option>{clinicalPatients.map((patient) => <option key={patient.patient_id} value={patient.patient_id}>{patient.full_name} ({patient.patient_id})</option>)}</select> : <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-3 text-sm">{selectedClinicalPatient?.full_name || "Loading your patient record"}</div>}
                        <input value={aiInputs.disease} onChange={(event) => setAiInputs((current) => ({ ...current, disease: event.target.value }))} placeholder="Disease (required)" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm" />
                        <input type="number" min="0" max="10" value={aiInputs.severity} onChange={(event) => setAiInputs((current) => ({ ...current, severity: event.target.value }))} placeholder="Severity / score (0-10)" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm" />
                        <input value={aiInputs.abnormal} onChange={(event) => setAiInputs((current) => ({ ...current, abnormal: event.target.value }))} placeholder="Abnormal result (required)" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm" />
                        <input type="number" min="0" value={aiInputs.symptomCount} onChange={(event) => setAiInputs((current) => ({ ...current, symptomCount: event.target.value }))} placeholder="Symptom count (required)" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm" />
                        <input value={aiInputs.chronic} onChange={(event) => setAiInputs((current) => ({ ...current, chronic: event.target.value }))} placeholder="Chronic condition (required)" className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm" />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">Diagnosis and symptoms come from the selected medical record; age, visits, and days since last visit come from backend data.</p>
                    <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={() => runPrediction("priority")} disabled={aiLoading}>Predict Priority</Button><Button type="button" variant="subtle" onClick={() => runPrediction("wait")} disabled={aiLoading}>Estimate Wait Time</Button></div>
                    {aiLoading ? <p className="mt-4 text-sm text-[var(--muted)]">Loading prediction…</p> : null}
                    {aiError ? <p className="mt-4 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{aiError}</p> : null}
                    {aiResult ? <div className="mt-4 rounded-2xl bg-[var(--panel-muted)] px-4 py-4 text-sm"><p className="font-semibold text-[var(--ink)]">{aiResult.kind === "priority" ? `Predicted priority: ${aiResult.data.prediction}` : `Estimated wait time: ${aiResult.data.estimated_wait_time.toFixed(1)} minutes`}</p>{aiResult.kind === "priority" ? <p className="mt-2 text-[var(--muted)]">Class probabilities: {Object.entries(aiResult.data.probabilities).map(([key, value]) => `${key}: ${(value * 100).toFixed(1)}%`).join(" • ")}</p> : null}<p className="mt-2 text-[var(--muted)]">{aiResult.data.advisory}</p></div> : null}
                </Card>
            ) : null}

            <Card className="flex min-h-[560px] flex-col p-4 sm:min-h-[620px] sm:p-6">
                <div className="flex-1 space-y-4 overflow-y-auto rounded-[28px] bg-[linear-gradient(180deg,#f7fbfd_0%,#eef7f1_100%)] p-5">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`text-wrap-anywhere max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[72%] ${
                                    message.sender === "user"
                                        ? "bg-[linear-gradient(135deg,#4d86d1_0%,#2768bb_100%)] text-white"
                                        : "bg-white text-[var(--ink)]"
                                }`}
                            >
                                {message.text}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 space-y-4">
                    {isPatient && mode === "home" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={handleStartBooking}
                                className="rounded-[26px] border border-[var(--line)] bg-[var(--panel-muted)] p-5 text-left shadow-sm"
                            >
                                <p className="font-display text-2xl text-[var(--ink)]">Book Appointment</p>
                                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                    Share your preferred department, doctor, date, and reason for visit.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={handleStartGuidance}
                                className="rounded-[26px] border border-[var(--line)] bg-[var(--panel-muted)] p-5 text-left shadow-sm"
                            >
                                <p className="font-display text-2xl text-[var(--ink)]">Minor Health Guidance</p>
                                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                    Get general suggestions for mild symptoms like headache, cough, or sneezing.
                                </p>
                            </button>
                        </div>
                    ) : null}

                    {isPatient && mode === "guidance" ? (
                        <Card className="p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                {Object.entries(symptomGuidance).map(([key, item]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleSelectSymptom(key)}
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

                            {selectedGuidance ? (
                                <div className="mt-5 rounded-[24px] bg-[var(--panel-muted)] p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="font-display text-2xl text-[var(--ink)]">{selectedGuidance.title}</h3>
                                        <StatusPill tone="amber">General guidance only</StatusPill>
                                    </div>
                                    <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                                        {selectedGuidance.advice.map((line) => (
                                            <li key={line} className="rounded-2xl bg-white px-4 py-3">
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-4 text-sm leading-7 text-[#8a5d3d]">{disclaimer}</p>
                                </div>
                            ) : null}
                        </Card>
                    ) : null}

                    {isPatient && mode === "book-appointment" ? (
                        <Card className="p-5">
                            <h3 className="font-display text-2xl text-[var(--ink)]">Book Appointment</h3>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                Capture the visit preferences first so the booking request can be reviewed quickly.
                            </p>

                            <form onSubmit={handleAppointmentSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
                                {appointmentQuestions.map((field) => (
                                    <label key={field.key} className={field.key === "reason" ? "md:col-span-2" : ""}>
                                        <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">{field.label}</span>
                                        <input
                                            value={formValues[field.key]}
                                            onChange={(event) => handlePatientFormChange(field.key, event.target.value)}
                                            className="w-full rounded-[20px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                            placeholder={field.placeholder}
                                        />
                                    </label>
                                ))}

                                <div className="md:col-span-2 flex justify-end">
                                    <Button type="submit" className="px-6">Save Booking Request</Button>
                                </div>
                            </form>
                        </Card>
                    ) : null}

                    {(isDoctor || isReceptionist) ? (
                        <Card className="p-5">
                            <h3 className="font-display text-2xl text-[var(--ink)]">Patient Finder</h3>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                Search by patient name or unique ID to pull up a quick clinical summary.
                            </p>

                            <form onSubmit={handleDoctorFinder} className="mt-5 flex flex-col gap-3 sm:flex-row">
                                <input
                                    value={finderQuery}
                                    onChange={(event) => setFinderQuery(event.target.value)}
                                    placeholder="Search by patient name or ID"
                                    className="flex-1 rounded-[20px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                />
                                <Button type="submit" className="px-6">Find Patient</Button>
                            </form>

                            {finderResult ? (
                                <div className="mt-5 rounded-[24px] bg-[var(--panel-muted)] p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-display text-3xl text-[var(--ink)]">{finderResult.full_name}</p>
                                            <p className="mt-1 text-sm text-[var(--muted)]">
                                                {finderResult.patient_id} • {finderResult.gender}
                                            </p>
                                        </div>
                                        <StatusPill tone={finderResult.status === "Stable" || finderResult.status === "Improving" ? "green" : "amber"}>
                                            {finderResult.status}
                                        </StatusPill>
                                    </div>

                                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                                        <div className="rounded-2xl bg-white px-4 py-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Phone</p>
                                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{finderResult.phone}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-4 py-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Visits</p>
                                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{finderResult.visits.length}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-4 py-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Clinical Records</p>
                                            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{finderResult.records.length}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </Card>
                    ) : null}

                    {isAdmin ? (
                        <Card className="p-5">
                            <h3 className="font-display text-2xl text-[var(--ink)]">Mitra Availability</h3>
                            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                                Guided symptom support is limited to the patient workspace. In the doctor workspace, Mitra acts as a patient finder for faster record lookup.
                            </p>
                        </Card>
                    ) : null}

                    <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--panel-muted)] p-2 sm:flex-row sm:rounded-full">
                        <input
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={isDoctor ? "Ask Mitra for a follow-up note..." : "Ask Mitra a follow-up question..."}
                            className="min-h-10 flex-1 rounded-full bg-transparent px-4 text-sm text-[var(--ink)] outline-none"
                        />
                        <Button type="submit" className="px-6">Send</Button>
                    </form>
                </div>
            </Card>
        </div>
    )
}

export default CareAI
