import Card from "../../common/Card"
import StatusPill from "../../common/StatusPill"

function PatientIdCard({ profile }) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Patient ID</p>
                    <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">{profile.id}</h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        Use this unique ID for check-in, appointment follow-ups, and prescription tracking.
                    </p>
                </div>
                <StatusPill tone={profile.insurance === "Active" ? "green" : "amber"}>{profile.insurance}</StatusPill>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Phone</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{profile.phone}</p>
                </div>
                <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Blood Group</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{profile.bloodGroup}</p>
                </div>
                <div className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Assistance</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{profile.assistance}</p>
                </div>
            </div>
        </Card>
    )
}

export default PatientIdCard
