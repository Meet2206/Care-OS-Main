import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import MetricCard from "../../components/common/MetricCard"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import { apiRequest } from "../../api/client"

function ReceptionDashboard() {
    const navigate = useNavigate()
    const [patients, setPatients] = useState([])
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const refresh = () => {
        setLoading(true)
        Promise.all([apiRequest("/patients?limit=100"), apiRequest("/appointments?limit=100")])
            .then(([patientResult, appointmentResult]) => {
                setPatients(patientResult.data)
                setAppointments(appointmentResult.data)
                setError("")
            })
            .catch((requestError) => setError(requestError.message || "Unable to load reception data."))
            .finally(() => setLoading(false))
    }

    useEffect(() => { refresh() }, [])

    const scheduled = appointments.filter((item) => item.status === "Scheduled").length
    const completed = appointments.filter((item) => item.status === "Completed").length

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Reception Operations"
                title="Front Desk Coordination"
                description="Register patients, keep the appointment desk moving, and quickly find the right patient record for the care team."
                actions={<Button onClick={() => navigate("/admin/patients/new")}>Register Patient</Button>}
            />
            {error ? <div className="rounded-2xl border border-[#f0c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{error}</div> : null}
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Registered Patients" value={loading ? "—" : patients.length} note="Live backend directory" tone="blue" />
                <MetricCard label="Scheduled Visits" value={loading ? "—" : scheduled} note="Current appointment queue" tone="green" />
                <MetricCard label="Completed Visits" value={loading ? "—" : completed} note="Clinical records in progress" tone="sky" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="p-6">
                    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-3xl text-[var(--ink)]">Today&apos;s Desk Queue</h2><Button variant="subtle" onClick={refresh}>Refresh</Button></div>
                    <div className="mt-5 space-y-3">
                        {appointments.slice(0, 8).map((appointment) => {
                            const patient = patients.find((item) => item.patient_id === appointment.patient_id)
                            return <div key={appointment.appointment_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--panel-muted)] px-4 py-4"><div><p className="font-semibold text-[var(--ink)]">{patient?.full_name || appointment.patient_id}</p><p className="mt-1 text-sm text-[var(--muted)]">{appointment.appointment_date} · {appointment.appointment_time} · {appointment.reason}</p></div><StatusPill tone={appointment.status === "Completed" ? "green" : "blue"}>{appointment.status}</StatusPill></div>
                        })}
                        {!loading && !appointments.length ? <p className="py-8 text-center text-sm text-[var(--muted)]">No appointments in the queue.</p> : null}
                    </div>
                </Card>
                <Card className="p-6"><h2 className="font-display text-3xl text-[var(--ink)]">Quick Actions</h2><div className="mt-5 space-y-3"><Button className="w-full justify-center" onClick={() => navigate("/admin/patients/new")}>Register New Patient</Button><Button variant="subtle" className="w-full justify-center" onClick={() => navigate("/admin/patients")}>Open Patient Directory</Button><Button variant="subtle" className="w-full justify-center" onClick={() => navigate("/ai")}>Find Patient with CareAI</Button></div><div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] p-4 text-sm leading-6 text-[var(--muted)]">Reception is the coordination layer: identity, registration, queue visibility, and routing patients to the right clinical team.</div></Card>
            </div>
        </div>
    )
}

export default ReceptionDashboard
