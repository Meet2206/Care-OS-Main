import Card from "../../common/Card"
import Button from "../../common/Button"
import StatusPill from "../../common/StatusPill"

function OperationsPanel({ departments, doctors, onOpenDepartment, onOpenDoctor }) {
    return (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
                <h2 className="font-display text-3xl text-[var(--ink)]">Department Watch</h2>
                <div className="mt-5 space-y-4">
                    {departments.map((department) => (
                        <div key={department.name} className="flex flex-col gap-3 rounded-2xl bg-[var(--panel-muted)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold text-[var(--ink)]">{department.name}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{department.doctors} doctors • Queue {department.queue}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone={department.status === "Stable" ? "green" : "amber"}>{department.status}</StatusPill>
                                <Button variant="subtle" className="px-4 py-2" onClick={() => onOpenDepartment(department)}>
                                    View
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="font-display text-3xl text-[var(--ink)]">Doctor Availability</h2>
                <div className="mt-5 space-y-4">
                    {doctors.map((doctor) => (
                        <div key={doctor.name} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="font-semibold text-[var(--ink)]">{doctor.name}</p>
                                    <p className="mt-1 text-sm text-[var(--muted)]">{doctor.department}</p>
                                    <p className="mt-2 text-sm text-[var(--muted)]">{doctor.mode}</p>
                                </div>
                                <Button variant="subtle" className="px-4 py-2" onClick={() => onOpenDoctor(doctor)}>
                                    Manage
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    )
}

export default OperationsPanel
