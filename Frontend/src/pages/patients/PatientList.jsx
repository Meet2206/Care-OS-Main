import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Card from "../../components/common/Card"
import Button from "../../components/common/Button"
import StatusPill from "../../components/common/StatusPill"
import { existingPatients } from "../../data/mockData"

const statusTones = {
    Active: "green",
    "Follow-up": "blue",
    Discharged: "amber",
    Inactive: "neutral",
}

function PatientList() {
    const navigate = useNavigate()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    const filtered = existingPatients.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.id.toLowerCase().includes(search.toLowerCase()) ||
            p.mobile.includes(search)

        const matchesStatus = statusFilter === "all" || p.status === statusFilter

        return matchesSearch && matchesStatus
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Patients</p>
                    <h1 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">Patient Directory</h1>
                    <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                        View registered patients, search by name or ID, and register new patients into CareOS.
                    </p>
                </div>
                <Button onClick={() => navigate("/admin/patients/new")}>
                    <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Add New Patient
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Total Patients</p>
                    <p className="mt-1 font-display text-3xl text-[var(--ink)]">{existingPatients.length}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Active</p>
                    <p className="mt-1 font-display text-3xl text-emerald-600">
                        {existingPatients.filter((p) => p.status === "Active").length}
                    </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Follow-up</p>
                    <p className="mt-1 font-display text-3xl text-[var(--primary-blue)]">
                        {existingPatients.filter((p) => p.status === "Follow-up").length}
                    </p>
                </div>
            </div>

            {/* Search and filter bar */}
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-sm">
                    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" strokeLinecap="round" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, ID, or mobile…"
                        className="w-full rounded-xl border border-[var(--line)] bg-white/80 py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] outline-none transition-all placeholder:text-[var(--muted)]/50 focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                        aria-label="Search patients"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {["all", "Active", "Follow-up", "Discharged"].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                statusFilter === status
                                    ? "bg-[var(--primary-blue)] text-white"
                                    : "bg-white/70 text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"
                            }`}
                        >
                            {status === "all" ? "All" : status}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Patient list */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <Card className="px-6 py-12 text-center">
                        <p className="text-lg font-semibold text-[var(--muted)]">No patients found</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Try adjusting your search or filter</p>
                    </Card>
                ) : (
                    filtered.map((patient) => (
                        <Card
                            key={patient.id}
                            className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                        >
                            <button
                                type="button"
                                onClick={() => navigate(`/admin/patients/${patient.id}`)}
                                className="flex flex-1 items-center gap-4 text-left"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8f0fb] to-[#dbeafe] text-sm font-bold text-[var(--primary-blue)]">
                                    {patient.name.split(" ").map((n) => n[0]).join("")}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-[var(--ink)]">{patient.name}</p>
                                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                                        <span className="font-mono text-xs">{patient.id}</span>
                                        <span className="mx-2 text-[var(--line)]">•</span>
                                        {patient.mobile}
                                        <span className="mx-2 text-[var(--line)]">•</span>
                                        {patient.bloodGroup}
                                    </p>
                                </div>
                            </button>
                            <div className="flex items-center gap-3">
                                <StatusPill tone={statusTones[patient.status] || "neutral"}>{patient.status}</StatusPill>
                                <span className="text-xs text-[var(--muted)]">{patient.doctor}</span>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

export default PatientList
