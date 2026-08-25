function PatientCard({ data, className = "" }) {
    const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Patient Name"

    return (
        <div className={`mx-auto w-full max-w-sm ${className}`} id="patient-card-preview">
            <div className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white shadow-lg">
                {/* Header band */}
                <div className="bg-gradient-to-r from-[#0f9fb4] to-[#3f78c8] px-5 py-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold tracking-[0.12em] text-white">CareOS</p>
                        <p className="text-xs font-medium text-white/80">Patient ID Card</p>
                    </div>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                    <div className="flex items-start gap-4">
                        {/* Avatar with initials */}
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8f0fb] to-[#dbeafe] text-xl font-bold text-[var(--primary-blue)]">
                            {`${(data.firstName || "P")[0]}${(data.lastName || "")[0] || ""}`.toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="font-display text-lg font-semibold text-[var(--ink)]">{fullName}</p>
                            {data.patientId && (
                                <p className="mt-0.5 font-mono text-sm font-bold text-[var(--primary-blue)]">
                                    {data.patientId}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Details grid */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        {data.bloodGroup && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Blood Group</p>
                                <p className="mt-0.5 text-sm font-bold text-[var(--ink)]">{data.bloodGroup}</p>
                            </div>
                        )}
                        {data.assignedDoctor && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Doctor</p>
                                <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{data.assignedDoctor}</p>
                            </div>
                        )}
                    </div>

                    {/* QR Code placeholder */}
                    <div className="mt-4 flex items-center justify-between border-t border-dashed border-[var(--line)] pt-4">
                        <div className="grid h-16 w-16 grid-cols-4 grid-rows-4 gap-0.5 rounded-lg bg-white p-1">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`rounded-sm ${Math.random() > 0.35 ? "bg-[var(--ink)]" : "bg-transparent"}`}
                                />
                            ))}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Scan to Verify</p>
                            {data.verificationCode && (
                                <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{data.verificationCode}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer band */}
                <div className="border-t border-[var(--line)] bg-[var(--panel-muted)] px-5 py-2 text-center">
                    <p className="text-[10px] tracking-[0.14em] text-[var(--muted)]">
                        This card is property of CareOS Healthcare System
                    </p>
                </div>
            </div>
        </div>
    )
}

export default PatientCard
