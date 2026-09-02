import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import MetricCard from "../../components/common/MetricCard"
import PageIntro from "../../components/common/PageIntro"
import StatusPill from "../../components/common/StatusPill"
import AsyncState from "../../components/common/AsyncState"
import { apiRequest } from "../../api/client"

const STATUS_TONES = { Scheduled: "blue", Completed: "green", Cancelled: "coral", "No Show": "amber" }

function formatDate(value) {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
        ? String(value).slice(0, 10)
        : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

function currency(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

/**
 * Operational overview built from the live /dashboard endpoints.
 *
 * This screen previously rendered a fixed set of numbers from a local mock
 * module, so it showed identical figures regardless of what was in the database.
 */
function AdminDashboard() {
    const [overview, setOverview] = useState(null)
    const [appointments, setAppointments] = useState(null)
    const [departments, setDepartments] = useState([])
    const [doctors, setDoctors] = useState([])
    const [recent, setRecent] = useState(null)
    const [revenue, setRevenue] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const year = new Date().getFullYear()
            const [
                overviewResult, appointmentResult, departmentResult,
                doctorResult, recentResult, revenueResult,
            ] = await Promise.all([
                apiRequest("/dashboard/overview"),
                apiRequest("/dashboard/appointments"),
                apiRequest("/dashboard/departments"),
                apiRequest("/dashboard/doctors"),
                apiRequest("/dashboard/recent"),
                apiRequest(`/dashboard/revenue?year=${year}`),
            ])
            setOverview(overviewResult)
            setAppointments(appointmentResult)
            setDepartments(departmentResult)
            setDoctors(doctorResult)
            setRecent(recentResult)
            setRevenue(revenueResult)
        } catch (requestError) {
            setError(requestError.message || "Unable to load the operations overview.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Quadrant 1"
                title="Operations Overview"
                description="Live hospital activity across patients, clinicians, scheduling, and revenue."
                actions={
                    <>
                        <Link to="/admin/patients"><Button variant="subtle">Patient Registry</Button></Link>
                        <Link to="/admin/patients/new"><Button>Register Patient</Button></Link>
                    </>
                }
            />

            <AsyncState loading={loading} error={error} onRetry={load} empty={false}>
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Total Patients" value={String(overview?.total_patients ?? 0)} helper={`${overview?.today_appointments ?? 0} appointments today`} />
                        <MetricCard label="Active Doctors" value={String(overview?.total_doctors ?? 0)} helper={`${departments.length} department${departments.length === 1 ? "" : "s"}`} />
                        <MetricCard label="Appointments" value={String(overview?.total_appointments ?? 0)} helper={`${appointments?.completed ?? 0} completed`} />
                        <MetricCard label="Revenue (YTD)" value={currency(revenue?.total_revenue)} helper={`${currency(revenue?.pending)} pending`} />
                    </div>

                    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">Appointment Mix</h2>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {[
                                    ["Scheduled", appointments?.scheduled, "blue"],
                                    ["Completed", appointments?.completed, "green"],
                                    ["Cancelled", appointments?.cancelled, "coral"],
                                    ["This week", appointments?.this_week, "neutral"],
                                ].map(([label, value, tone]) => (
                                    <div key={label} className="min-w-0 rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
                                            <StatusPill tone={tone}>{value ?? 0}</StatusPill>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">Departments</h2>
                            <div className="mt-5 max-h-64 space-y-3 overflow-y-auto pr-1">
                                {departments.length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">No departments recorded yet.</p>
                                ) : departments.map((department) => (
                                    <div key={department.department} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-[var(--panel-muted)] px-4 py-3">
                                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{department.department}</p>
                                        <p className="shrink-0 text-xs text-[var(--muted)]">
                                            {department.doctor_count} doctor{department.doctor_count === 1 ? "" : "s"} · {department.appointment_count} visits
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <Card className="min-w-0 p-5">
                        <h2 className="font-display text-2xl text-[var(--ink)]">Clinician Load</h2>
                        <div className="responsive-table scroll-table mt-5 -mx-1 min-w-0 overflow-x-auto px-1">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                        <th className="py-3 pr-4">Doctor</th>
                                        <th className="py-3 pr-4">Appointments</th>
                                        <th className="py-3 pr-4">Patients</th>
                                        <th className="py-3">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctors.length === 0 ? (
                                        <tr><td colSpan={4} className="py-4 text-sm text-[var(--muted)]">No clinicians recorded yet.</td></tr>
                                    ) : doctors.map((doctor) => (
                                        <tr key={doctor.doctor_id} className="border-t border-[var(--line)]">
                                            <td className="py-3 pr-4 font-semibold text-[var(--ink)]" data-label="Doctor">{doctor.doctor_name}</td>
                                            <td className="py-3 pr-4" data-label="Appointments">{doctor.appointments}</td>
                                            <td className="py-3 pr-4" data-label="Patients">{doctor.patients}</td>
                                            <td className="py-3" data-label="Revenue">{currency(doctor.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">Recent Registrations</h2>
                            <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                                {(recent?.patients || []).length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">No recent registrations.</p>
                                ) : recent.patients.map((patient) => (
                                    <div key={patient.patient_id || patient.full_name} className="min-w-0 rounded-2xl bg-[var(--panel-muted)] px-4 py-3">
                                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{patient.full_name}</p>
                                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{patient.patient_id} · {patient.phone}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="min-w-0 p-5">
                            <h2 className="font-display text-2xl text-[var(--ink)]">Recent Appointments</h2>
                            <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                                {(recent?.appointments || []).length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">No recent appointments.</p>
                                ) : recent.appointments.map((appointment) => (
                                    <div key={appointment.appointment_id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-[var(--panel-muted)] px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--ink)]">{appointment.appointment_id}</p>
                                            <p className="mt-1 truncate text-xs text-[var(--muted)]">{formatDate(appointment.appointment_date)} · {appointment.appointment_time}</p>
                                        </div>
                                        <StatusPill tone={STATUS_TONES[appointment.status] || "neutral"}>{appointment.status}</StatusPill>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </AsyncState>
        </div>
    )
}

export default AdminDashboard
