import { calculateAge } from "../../../utils/patientHelpers"
import { appointmentTypes, doctorsList } from "../../../data/mockData"

function StepReview({ formData }) {
    const age = calculateAge(formData.dob)
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()
    const apptType = appointmentTypes.find((t) => t.value === formData.appointmentType)
    const doctor = doctorsList.find((d) => d.name === formData.assignedDoctor)

    return (
        <div className="anim-fade-in-up space-y-6">
            <div>
                <h2 className="font-display text-2xl text-[var(--ink)] sm:text-3xl">Review & Confirm</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                    Verify all details before generating the Patient ID
                </p>
            </div>

            {/* Summary Card */}
            <div className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white/80 shadow-sm">
                {/* Patient header */}
                <div className="flex flex-col items-start gap-4 border-b border-[var(--line)] bg-gradient-to-r from-[#f0f7ff] to-[#eef8f0] px-6 py-5 sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary-blue)] to-[#1a6fb5] text-xl font-bold text-white shadow-sm">
                        {(formData.firstName?.[0] || "P")}{(formData.lastName?.[0] || "")}
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{fullName || "Patient Name"}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                            {age !== null && <span>Age {age}</span>}
                            {age !== null && formData.bloodGroup && <span className="text-[var(--line)]">•</span>}
                            {formData.bloodGroup && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                                    {formData.bloodGroup}
                                </span>
                            )}
                            {formData.gender && (
                                <>
                                    <span className="text-[var(--line)]">•</span>
                                    <span>{formData.gender}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="divide-y divide-[var(--line)]/50">
                    {/* Basic Info */}
                    <ReviewSection title="Contact Information">
                        <ReviewRow label="Phone" value={formData.mobile} />
                        <ReviewRow label="Email" value={formData.email || "—"} />
                        <ReviewRow label="Address" value={formData.address || "—"} />
                        <ReviewRow label="Aadhaar Number" value={formData.aadhaarNumber || "—"} />
                    </ReviewSection>

                    {/* Emergency Contact */}
                    {(formData.emergencyContactName || formData.emergencyContactNumber) && (
                        <ReviewSection title="Emergency Contact">
                            <ReviewRow label="Name" value={formData.emergencyContactName || "—"} />
                            <ReviewRow label="Relation" value={formData.emergencyContactRelation || "—"} />
                            <ReviewRow label="Contact Number" value={formData.emergencyContactNumber || "—"} />
                        </ReviewSection>
                    )}

                    {/* Medical Info */}
                    <ReviewSection title="Medical Information">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <ReviewRow label="Height" value={formData.height ? `${formData.height} cm` : "—"} />
                            <ReviewRow label="Weight" value={formData.weight ? `${formData.weight} kg` : "—"} />
                        </div>
                        {formData.allergies.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Allergies</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {formData.allergies.map((a) => (
                                        <span key={a} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">{a}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {formData.chronicDiseases.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Chronic Diseases</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {formData.chronicDiseases.map((d) => (
                                        <span key={d} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{d}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {formData.medications.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Current Medications</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {formData.medications.map((m) => (
                                        <span key={m} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{m}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {formData.medicalNotes && (
                            <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Notes</p>
                                <p className="mt-1 text-sm text-[var(--ink)]">{formData.medicalNotes}</p>
                            </div>
                        )}
                    </ReviewSection>

                    {/* Doctor Assignment */}
                    <ReviewSection title="Doctor Assignment">
                        {doctor ? (
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f0fb] to-[#dbeafe] text-sm font-bold text-[var(--primary-blue)]">
                                    {doctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[var(--ink)]">{doctor.name}</p>
                                    <p className="text-xs text-[var(--muted)]">{doctor.specialty} • {doctor.location}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--muted)]">No doctor assigned</p>
                        )}
                        <div className="mt-3">
                            <ReviewRow label="Appointment Type" value={apptType ? `${apptType.icon} ${apptType.label}` : "—"} />
                        </div>
                    </ReviewSection>
                </div>
            </div>

            {/* Actions note */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">After Registration</p>
                <div className="mt-2 grid gap-1.5 text-sm text-[var(--muted)] sm:grid-cols-2">
                    <span>✦ Patient profile created</span>
                    <span>✦ UUID & Patient ID generated</span>
                    <span>✦ Doctor assigned & notified</span>
                    <span>✦ Medical record initialized</span>
                    <span>✦ Login credentials generated</span>
                    <span>✦ QR code created</span>
                    <span>✦ SMS & WhatsApp sent</span>
                    <span>✦ Email confirmation sent</span>
                </div>
            </div>
        </div>
    )
}

function ReviewSection({ title, children }) {
    return (
        <div className="px-6 py-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-blue)]">{title}</p>
            {children}
        </div>
    )
}

function ReviewRow({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</span>
            <span className="text-right text-sm font-medium text-[var(--ink)]">{value}</span>
        </div>
    )
}

export default StepReview
