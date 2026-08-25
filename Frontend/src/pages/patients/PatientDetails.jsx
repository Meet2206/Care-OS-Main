import { useParams, useNavigate } from "react-router-dom"
import Card from "../../components/common/Card"
import Button from "../../components/common/Button"
import StatusPill from "../../components/common/StatusPill"
import PatientCard from "../../components/modules/patients/PatientCard"
import { existingPatients, doctorsList } from "../../data/mockData"

const statusTones = {
    Active: "green",
    "Follow-up": "blue",
    Discharged: "amber",
    Inactive: "neutral",
}

function PatientDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const patient = existingPatients.find((p) => p.id === id)

    if (!patient) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="font-display text-2xl text-[var(--ink)]">Patient not found</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{`The patient ID "${id}" does not exist.`}</p>
                <Button className="mt-6" onClick={() => navigate("/admin/patients")}>Back to Patients</Button>
            </div>
        )
    }

    const doctor = doctorsList.find((d) => d.name === patient.doctor)
    const nameParts = patient.name.split(" ")
    const cardData = {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        bloodGroup: patient.bloodGroup,
        assignedDoctor: patient.doctor,
        patientId: patient.id,
        verificationCode: `MLEIET-${Math.floor(Math.random() * 999).toString().padStart(3, "0")}-${Math.random().toString(16).substring(2, 6).toUpperCase()}`,
        profilePhotoPreview: null,
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate("/admin/patients")}
                        className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Patients
                    </button>
                    <h1 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">{patient.name}</h1>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
                        <span className="font-mono text-xs font-bold text-[var(--primary-blue)]">{patient.id}</span>
                        <StatusPill tone={statusTones[patient.status] || "neutral"}>{patient.status}</StatusPill>
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="subtle" onClick={() => navigate("/admin/patients/new")}>
                        <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                        Register New
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                {/* Main info */}
                <div className="space-y-4">
                    {/* Contact */}
                    <Card className="p-6">
                        <h2 className="mb-4 font-display text-2xl text-[var(--ink)]">Contact Information</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InfoField label="Phone" value={patient.mobile} />
                            <InfoField label="Email" value={patient.email} />
                            <InfoField label="Blood Group" value={patient.bloodGroup} />
                            <InfoField label="Assigned Doctor" value={patient.doctor} />
                        </div>
                    </Card>

                    {/* Doctor Card */}
                    {doctor && (
                        <Card className="p-6">
                            <h2 className="mb-4 font-display text-2xl text-[var(--ink)]">Doctor Assignment</h2>
                            <div className="flex items-center gap-4 rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f0fb] to-[#dbeafe] text-sm font-bold text-[var(--primary-blue)]">
                                    {doctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
                                </div>
                                <div>
                                    <p className="font-semibold text-[var(--ink)]">{doctor.name}</p>
                                    <p className="text-sm text-[var(--muted)]">{doctor.specialty} • {doctor.location}</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Medical stub */}
                    <Card className="p-6">
                        <h2 className="mb-4 font-display text-2xl text-[var(--ink)]">Medical Records</h2>
                        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel-muted)]/50 px-6 py-8 text-center">
                            <p className="text-sm font-semibold text-[var(--muted)]">Medical records will appear here</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">Records will be populated once the backend is connected</p>
                        </div>
                    </Card>
                </div>

                {/* Sidebar — Patient Card */}
                <div className="space-y-4">
                    <PatientCard data={cardData} />
                    <div className="text-center">
                        <p className="text-xs text-[var(--muted)]">Patient ID card preview</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoField({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value || "—"}</p>
        </div>
    )
}

export default PatientDetails
