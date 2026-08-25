import { useState } from "react"
import { doctorsList, appointmentTypes } from "../../../data/mockData"

function StepDoctorAssignment({ formData, onChange }) {
    const [doctorSearch, setDoctorSearch] = useState("")
    const [showDoctorDropdown, setShowDoctorDropdown] = useState(false)

    const filteredDoctors = doctorsList.filter(
        (d) =>
            d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            d.specialty.toLowerCase().includes(doctorSearch.toLowerCase()),
    )

    const update = (field, value) => {
        onChange({ ...formData, [field]: value })
    }

    const selectedDoctor = doctorsList.find((d) => d.name === formData.assignedDoctor)

    return (
        <div className="anim-fade-in-up space-y-8">
            <div>
                <h2 className="font-display text-2xl text-[var(--ink)] sm:text-3xl">Doctor Assignment</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                    Assign a primary doctor and select the appointment type
                </p>
            </div>

            {/* Doctor Selection */}
            <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                    Assign Doctor
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={showDoctorDropdown ? doctorSearch : formData.assignedDoctor || ""}
                        onChange={(e) => { setDoctorSearch(e.target.value); setShowDoctorDropdown(true) }}
                        onFocus={() => { setShowDoctorDropdown(true); setDoctorSearch("") }}
                        placeholder="Search doctors by name or specialty…"
                        className="form-input pr-10"
                        role="combobox"
                        aria-expanded={showDoctorDropdown}
                        aria-label="Search and select a doctor"
                    />
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" strokeLinecap="round" />
                    </svg>

                    {showDoctorDropdown && (
                        <>
                            <button
                                type="button"
                                className="fixed inset-0 z-10"
                                onClick={() => setShowDoctorDropdown(false)}
                                aria-label="Close dropdown"
                            />
                            <div className="anim-fade-in-up absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/95 py-1 shadow-lg backdrop-blur-sm">
                                {filteredDoctors.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-[var(--muted)]">No doctors found</p>
                                ) : (
                                    filteredDoctors.map((doctor) => (
                                        <button
                                            key={doctor.name}
                                            type="button"
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--panel-muted)] ${
                                                formData.assignedDoctor === doctor.name ? "bg-[#e8f0fb]" : ""
                                            }`}
                                            onClick={() => {
                                                update("assignedDoctor", doctor.name)
                                                setShowDoctorDropdown(false)
                                                setDoctorSearch("")
                                            }}
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f0fb] to-[#dbeafe] text-sm font-bold text-[var(--primary-blue)]">
                                                {doctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-[var(--ink)]">{doctor.name}</p>
                                                <p className="text-xs text-[var(--muted)]">{doctor.specialty} • {doctor.location}</p>
                                            </div>
                                            {!doctor.available && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Unavailable</span>
                                            )}
                                            {formData.assignedDoctor === doctor.name && (
                                                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--primary-blue)]" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Selected doctor card */}
                {selectedDoctor && (
                    <div className="anim-fade-in-up mt-3 flex items-center gap-3 rounded-2xl border border-[var(--primary-blue)]/20 bg-[#e8f0fb]/50 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-blue)] text-sm font-bold text-white">
                            {selectedDoctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--ink)]">{selectedDoctor.name}</p>
                            <p className="text-xs text-[var(--muted)]">{selectedDoctor.specialty} • {selectedDoctor.location}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => update("assignedDoctor", "")}
                            className="text-xs font-medium text-red-400 hover:text-red-600"
                            aria-label="Remove doctor assignment"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>

            {/* Appointment Type */}
            <div>
                <label className="mb-3 block text-sm font-semibold text-[var(--ink)]">
                    Appointment Type
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                    {appointmentTypes.map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => update("appointmentType", type.value)}
                            className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                                formData.appointmentType === type.value
                                    ? "border-[var(--primary-blue)] bg-[#e8f0fb]/50 shadow-sm"
                                    : "border-[var(--line)] bg-white/60 hover:border-[var(--primary-blue)]/30 hover:bg-white/80"
                            }`}
                            aria-pressed={formData.appointmentType === type.value}
                        >
                            <span className="mt-0.5 text-xl">{type.icon}</span>
                            <div>
                                <p className={`text-sm font-semibold ${formData.appointmentType === type.value ? "text-[var(--primary-blue)]" : "text-[var(--ink)]"}`}>
                                    {type.label}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--muted)]">{type.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default StepDoctorAssignment
