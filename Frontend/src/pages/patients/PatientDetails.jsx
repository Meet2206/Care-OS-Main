import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Card from "../../components/common/Card"
import Button from "../../components/common/Button"
import StatusPill from "../../components/common/StatusPill"
import PatientCard from "../../components/modules/patients/PatientCard"
import { apiRequest } from "../../api/client"

const statusTones = {
    Active: "green",
    "Follow-up": "blue",
    Discharged: "amber",
    Inactive: "neutral",
}

function PatientDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        apiRequest(`/patients/${id}`)
            .then(setPatient)
            .catch((requestError) => setError(requestError.message || "Patient not found."))
            .finally(() => setLoading(false))
    }, [id])

    if (loading) {
        return <div className="py-20 text-center text-sm text-[var(--muted)]">Loading patient…</div>
    }

    if (!patient || error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="font-display text-2xl text-[var(--ink)]">Patient not found</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{`The patient ID "${id}" does not exist.`}</p>
                <Button className="mt-6" onClick={() => navigate("/admin/patients")}>Back to Patients</Button>
            </div>
        )
    }

    const nameParts = patient.full_name.split(" ")
    const cardData = {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        bloodGroup: patient.blood_group,
        assignedDoctor: "Clinical team",
        patientId: patient.patient_id,
        verificationCode: "Backend record",
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
                    <h1 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">{patient.full_name}</h1>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
                        <span className="font-mono text-xs font-bold text-[var(--primary-blue)]">{patient.patient_id}</span>
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
                            <InfoField label="Phone" value={patient.phone} />
                            <InfoField label="Email" value={patient.email} />
                            <InfoField label="Blood Group" value={patient.blood_group} />
                            <InfoField label="Status" value={patient.status} />
                        </div>
                    </Card>

                    {/* Doctor Card */}
                    <Card className="p-6"><h2 className="mb-4 font-display text-2xl text-[var(--ink)]">Emergency Contact</h2><InfoField label="Name" value={patient.emergency_contact_name} /><div className="mt-3"><InfoField label="Phone" value={patient.emergency_contact_phone} /></div></Card>

                    {/* Medical stub */}
                    <Card className="p-6">
                        <h2 className="mb-4 font-display text-2xl text-[var(--ink)]">Medical Records</h2>
                        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel-muted)]/50 px-6 py-8 text-center">
                            <p className="text-sm font-semibold text-[var(--muted)]">Medical records will appear here</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">Clinical records are available from the Medical Records workspace.</p>
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
