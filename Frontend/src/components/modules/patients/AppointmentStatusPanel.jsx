import Card from "../../common/Card"
import StatusPill from "../../common/StatusPill"

function AppointmentStatusPanel({ updates }) {
    return (
        <Card className="p-6">
            <h2 className="font-display text-3xl text-[var(--ink)]">Appointment Status</h2>
            <div className="mt-5 space-y-4">
                {updates.map((update) => (
                    <div key={update.title} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold text-[var(--ink)]">{update.title}</p>
                            <StatusPill tone={update.tone}>{update.tone === "amber" ? "Actioned" : update.tone === "green" ? "OK" : "Updated"}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{update.detail}</p>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default AppointmentStatusPanel
