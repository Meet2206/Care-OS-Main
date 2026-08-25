import { useState } from "react"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import MetricCard from "../../components/common/MetricCard"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import OperationsPanel from "../../components/modules/admin/OperationsPanel"
import { adminMetrics, adminPanels } from "../../data/mockData"

function AdminDashboard() {
    const [exportMessage, setExportMessage] = useState("")
    const [selectedDepartment, setSelectedDepartment] = useState(null)
    const [selectedDoctor, setSelectedDoctor] = useState(null)
    const [systemLogs, setSystemLogs] = useState(adminPanels.systemLogs)
    const [departments, setDepartments] = useState(adminPanels.departments)
    const [doctors, setDoctors] = useState(adminPanels.doctors)

    const handleExportSummary = () => {
        const report = [
            "CareOS Admin Summary",
            "",
            ...adminMetrics.map((metric) => `${metric.label}: ${metric.value} (${metric.note})`),
            "",
            "Recent System Logs:",
            ...systemLogs.map((log) => `- ${log}`),
        ].join("\n")

        const blob = new Blob([report], { type: "text/plain;charset=utf-8" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = "careos-admin-summary.txt"
        link.click()
        URL.revokeObjectURL(link.href)
        setExportMessage("Admin summary exported as a text file.")
    }

    const addAuditLog = (message) => {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        setSystemLogs((current) => [`${time} - ${message}`, ...current].slice(0, 8))
    }

    const requestDepartmentSupport = (department) => {
        setDepartments((current) =>
            current.map((item) =>
                item.name === department.name
                    ? { ...item, status: "Support requested", queue: item.queue === "Low" ? "Moderate" : item.queue }
                    : item,
            ),
        )
        setSelectedDepartment(null)
        addAuditLog(`${department.name} support request sent to staffing desk`)
    }

    const markDoctorAvailable = (doctor) => {
        setDoctors((current) =>
            current.map((item) => (item.name === doctor.name ? { ...item, mode: "Available" } : item)),
        )
        setSelectedDoctor(null)
        addAuditLog(`${doctor.name} availability updated to Available`)
    }

    return (
        <>
        <div className="space-y-6">
            <PageIntro
                eyebrow="Quadrant 1"
                title="Overview & System Health"
                description="High-level metrics, operational pressure points, and system visibility shaped for a hospital admin who needs clarity immediately."
                actions={<Button variant="subtle" onClick={handleExportSummary}>Export Summary</Button>}
            />

            {exportMessage ? (
                <div className="rounded-2xl border border-[#d4e7d9] bg-[#eef8f0] px-4 py-3 text-sm text-[#4c6a56]">
                    {exportMessage}
                </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-4">
                {adminMetrics.map((metric, index) => (
                    <MetricCard
                        key={metric.label}
                        {...metric}
                        tone={index === 0 ? "blue" : index === 1 ? "green" : index === 2 ? "sky" : "blue"}
                    />
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
                <Card className="p-6">
                    <h2 className="font-display text-3xl text-[var(--ink)]">Recent System Logs</h2>
                    <div className="mt-5 space-y-4">
                        {systemLogs.map((log) => (
                            <div key={log} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--muted)]">
                                {log}
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="space-y-4">
                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Patients by Ward</h2>
                        <div className="mt-5 space-y-4">
                            {adminPanels.operationalItems.map((item) => (
                                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                    <span className="text-sm text-[var(--muted)]">{item.label}</span>
                                    <span className="font-display text-3xl text-[var(--ink)]">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="font-display text-3xl text-[var(--ink)]">Doctors by Specialization</h2>
                        <div className="mt-5 space-y-4">
                            {adminPanels.specialization.map((item) => (
                                <div key={item.label}>
                                    <div className="mb-2 flex items-center justify-between text-sm text-[var(--muted)]">
                                        <span>{item.label}</span>
                                        <span>{item.value}</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-[#e7edf2]">
                                        <div className="h-3 rounded-full bg-[linear-gradient(90deg,#1aa4b7_0%,#8fd1af_100%)]" style={{ width: `${item.value * 2}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <OperationsPanel
                departments={departments}
                doctors={doctors}
                onOpenDepartment={setSelectedDepartment}
                onOpenDoctor={setSelectedDoctor}
            />
        </div>

        <Modal
            open={Boolean(selectedDepartment)}
            onClose={() => setSelectedDepartment(null)}
            title={selectedDepartment?.name}
            eyebrow="Department Watch"
        >
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em]">Doctors</p>
                        <p className="mt-2 font-display text-3xl text-[var(--ink)]">{selectedDepartment?.doctors}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em]">Queue</p>
                        <p className="mt-2 font-semibold text-[var(--ink)]">{selectedDepartment?.queue}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em]">Status</p>
                        <p className="mt-2 font-semibold text-[var(--ink)]">{selectedDepartment?.status}</p>
                    </div>
                </div>
                <p>
                    This action is scoped to hospital operations: requesting support updates the department watch state
                    and writes an admin audit log.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="subtle" onClick={() => setSelectedDepartment(null)}>Close</Button>
                    <Button onClick={() => requestDepartmentSupport(selectedDepartment)}>Request Support</Button>
                </div>
            </div>
        </Modal>

        <Modal
            open={Boolean(selectedDoctor)}
            onClose={() => setSelectedDoctor(null)}
            title={selectedDoctor?.name}
            eyebrow="Doctor Availability"
        >
            <div className="space-y-4">
                <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em]">Department</p>
                    <p className="mt-2 font-semibold text-[var(--ink)]">{selectedDoctor?.department}</p>
                    <p className="mt-2 text-sm">Current mode: {selectedDoctor?.mode}</p>
                </div>
                <p>
                    Marking this doctor available updates the operational roster only; it does not modify patient data.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="subtle" onClick={() => setSelectedDoctor(null)}>Close</Button>
                    <Button onClick={() => markDoctorAvailable(selectedDoctor)}>Mark Available</Button>
                </div>
            </div>
        </Modal>
        </>
    )
}

export default AdminDashboard
