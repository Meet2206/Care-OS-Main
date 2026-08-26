import { useState } from "react"
import { jsPDF } from "jspdf"
import PatientCard from "./PatientCard"

const CONFETTI_COLORS = ["#3f78c8", "#0f9fb4", "#8fd1af", "#f59e0b", "#ec4899", "#6366f1"]

function SuccessScreen({ formData, patientId, verificationCode, accountLoginId, temporaryPassword, onRegisterAnother, onViewPatient }) {
    const [showCard, setShowCard] = useState(false)
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()

    const cardData = {
        ...formData,
        patientId,
        verificationCode,
    }

    const handlePrint = () => {
        const doc = new jsPDF({ unit: "mm", format: [90, 55] })

        // Header band
        doc.setFillColor(15, 159, 180)
        doc.rect(0, 0, 90, 12, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.text("CareOS", 5, 8)
        doc.setFontSize(6)
        doc.setFont("helvetica", "normal")
        doc.text("Patient ID Card", 65, 8)

        // Patient name
        doc.setTextColor(45, 50, 56)
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.text(fullName || "Patient Name", 5, 20)

        // Patient ID
        doc.setFontSize(7)
        doc.setTextColor(63, 120, 200)
        doc.text(patientId, 5, 26)

        // Details
        doc.setTextColor(110, 116, 111)
        doc.setFontSize(5)
        doc.setFont("helvetica", "normal")

        if (formData.bloodGroup) {
            doc.text(`Blood Group: ${formData.bloodGroup}`, 5, 33)
        }
        if (formData.assignedDoctor) {
            doc.text(`Doctor: ${formData.assignedDoctor}`, 5, 38)
        }

        // QR placeholder
        doc.setDrawColor(200, 200, 200)
        doc.rect(65, 18, 18, 18)
        doc.setFontSize(4)
        doc.setTextColor(160, 160, 160)
        doc.text("QR Code", 69, 28)

        // Footer
        doc.setDrawColor(230, 221, 209)
        doc.line(5, 45, 85, 45)
        doc.setFontSize(4)
        doc.setTextColor(160, 160, 160)
        doc.text("Property of CareOS Healthcare System", 18, 50)

        doc.save(`CareOS-${patientId}.pdf`)
    }

    return (
        <div className="anim-fade-in-up space-y-8">
            {/* Confetti animation */}
            <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10px`,
                            width: `${6 + Math.random() * 8}px`,
                            height: `${6 + Math.random() * 8}px`,
                            backgroundColor: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                            animation: `confettiDrop ${1.5 + Math.random() * 2}s ${Math.random() * 0.8}s ease-in forwards`,
                            opacity: 0.9,
                        }}
                    />
                ))}
            </div>

            {/* Success animation */}
            <div className="flex flex-col items-center text-center">
                <div className="anim-scale-in mb-6">
                    <svg viewBox="0 0 64 64" className="mx-auto h-20 w-20">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#22c55e" strokeWidth="3" className="circle-draw" />
                        <polyline points="20 33 28 41 44 25" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
                    </svg>
                </div>
                <h2 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">Patient Registered Successfully</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                    All onboarding steps are complete. The patient profile is now active in CareOS.
                </p>
            </div>

            {accountLoginId && temporaryPassword ? (
                <div className="rounded-2xl border border-[#cfe3f2] bg-[#eef7fc] px-5 py-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Patient login created</p>
                    <p className="mt-3 text-sm text-[var(--muted)]">Give these temporary credentials to the patient. The password is shown only on this registration screen.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-[var(--muted)]">Login ID</p><p className="mt-1 font-semibold text-[var(--ink)]">{accountLoginId}</p></div><div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-[var(--muted)]">Temporary password</p><p className="mt-1 font-semibold text-[var(--ink)]">{temporaryPassword}</p></div></div>
                </div>
            ) : null}

            {/* ID Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-5 py-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Patient ID</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[var(--primary-blue)]">{patientId}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-5 py-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Verification Code</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[var(--ink)]">{verificationCode}</p>
                </div>
            </div>

            {/* Registration Timeline */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] px-5 py-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Registration Timeline
                </p>
                <div className="space-y-3">
                    {[
                        { time: "Just now", label: "Patient profile created", icon: "✓" },
                        { time: "Just now", label: "UUID generated", icon: "✓" },
                        { time: "Just now", label: `Patient ID assigned: ${patientId}`, icon: "✓" },
                        { time: "Just now", label: `Doctor ${formData.assignedDoctor || "—"} assigned`, icon: "✓" },
                        { time: "Just now", label: "Medical record initialized", icon: "✓" },
                        { time: "Just now", label: "Login account created", icon: "✓" },
                        { time: "Pending", label: "QR code generation", icon: "⟳" },
                        { time: "Pending", label: "SMS & WhatsApp notification", icon: "⟳" },
                        { time: "Pending", label: "Email confirmation", icon: "⟳" },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                item.icon === "✓"
                                    ? "bg-emerald-100 text-emerald-600"
                                    : "bg-amber-100 text-amber-600"
                            }`}>
                                {item.icon}
                            </span>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-[var(--ink)]">{item.label}</p>
                                <p className="text-xs text-[var(--muted)]">{item.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Patient Card Preview */}
            <div>
                <button
                    type="button"
                    onClick={() => setShowCard(!showCard)}
                    className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--primary-blue)] transition-colors hover:text-[var(--primary-blue)]/80"
                >
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${showCard ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {showCard ? "Hide" : "Show"} Patient Card Preview
                </button>
                {showCard && (
                    <div className="anim-fade-in-up">
                        <PatientCard data={cardData} />
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                    type="button"
                    onClick={onViewPatient}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/80 border border-[var(--line)] px-6 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all hover:bg-white hover:shadow-md"
                >
                    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-.274.857-.676 1.664-1.19 2.4M2.458 12a11.94 11.94 0 0 0 1.19 2.4" />
                    </svg>
                    View Patient
                </button>
                <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/80 border border-[var(--line)] px-6 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all hover:bg-white hover:shadow-md"
                >
                    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print Patient Card
                </button>
                <button
                    type="button"
                    onClick={onRegisterAnother}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--primary-blue)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-blue)]/90 hover:shadow-md"
                >
                    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Register Another Patient
                </button>
            </div>
        </div>
    )
}

export default SuccessScreen
