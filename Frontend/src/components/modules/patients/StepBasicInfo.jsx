import { useState, useEffect } from "react"
import { bloodGroups, existingPatients } from "../../../data/mockData"
import { validateMobile, validateEmail, calculateAge, checkDuplicatePatient } from "../../../utils/patientHelpers"
import CustomDatePicker from "../../common/CustomDatePicker"

/** Format raw digits into Aadhaar pattern: XXXX-XXXX-XXXX */
function formatAadhaar(value) {
    const digits = value.replace(/\D/g, "").slice(0, 12)
    const parts = []
    if (digits.length > 0) parts.push(digits.slice(0, 4))
    if (digits.length > 4) parts.push(digits.slice(4, 8))
    if (digits.length > 8) parts.push(digits.slice(8, 12))
    return parts.join("-")
}

/** Validate Aadhaar: must be exactly 12 digits */
function validateAadhaar(value) {
    if (!value) return { valid: true, message: "" }
    const digits = value.replace(/\D/g, "")
    if (digits.length === 0) return { valid: true, message: "" }
    if (digits.length < 12) return { valid: false, message: `${12 - digits.length} more digits required` }
    if (digits.length === 12) return { valid: true, message: "Aadhaar number valid" }
    return { valid: false, message: "Aadhaar must be 12 digits" }
}

function StepBasicInfo({ formData, onChange }) {
    const [duplicateWarnings, setDuplicateWarnings] = useState([])

    const mobileStatus = validateMobile(formData.mobile)
    const emailStatus = validateEmail(formData.email)
    const emergencyContactStatus = validateMobile(formData.emergencyContactNumber)
    const aadhaarStatus = validateAadhaar(formData.aadhaarNumber)
    const age = calculateAge(formData.dob)

    // Check for duplicates when mobile or email changes
    useEffect(() => {
        const warnings = checkDuplicatePatient(formData.mobile, formData.email, existingPatients)
        setDuplicateWarnings(warnings)
    }, [formData.mobile, formData.email])

    const update = (field, value) => {
        onChange({ ...formData, [field]: value })
    }

    const handleAadhaarChange = (e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 12)
        update("aadhaarNumber", formatAadhaar(raw))
    }

    return (
        <div className="anim-fade-in-up space-y-6">
            <div>
                <h2 className="font-display text-2xl text-[var(--ink)] sm:text-3xl">Basic Information</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                    Patient personal details and contact information
                </p>
            </div>

            {/* Duplicate warning banner */}
            {duplicateWarnings.length > 0 && (
                <div className="anim-fade-in-up rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-500">⚠</span>
                        <div>
                            <p className="text-sm font-semibold text-amber-800">Existing patient found</p>
                            {duplicateWarnings.map((w) => (
                                <p key={w.field} className="mt-0.5 text-sm text-amber-700">
                                    {w.patient.name} ({w.patient.id}) — matched by {w.field}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Name row */}
            <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="First Name" required>
                    <input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => update("firstName", e.target.value)}
                        placeholder="Enter first name"
                        className="form-input"
                        autoFocus
                        aria-required="true"
                    />
                </FieldGroup>
                <FieldGroup label="Last Name" required>
                    <input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => update("lastName", e.target.value)}
                        placeholder="Enter last name"
                        className="form-input"
                        aria-required="true"
                    />
                </FieldGroup>
            </div>

            {/* Gender */}
            <FieldGroup label="Gender">
                <div className="flex flex-wrap gap-3">
                    {["Male", "Female", "Other"].map((g) => (
                        <label
                            key={g}
                            className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all ${
                                formData.gender === g
                                    ? "border-[var(--primary-blue)] bg-[#e8f0fb] text-[var(--primary-blue)]"
                                    : "border-[var(--line)] bg-white/70 text-[var(--muted)] hover:border-[var(--primary-blue)]/40"
                            }`}
                        >
                            <input
                                type="radio"
                                name="gender"
                                value={g}
                                checked={formData.gender === g}
                                onChange={(e) => update("gender", e.target.value)}
                                className="sr-only"
                            />
                            {g}
                        </label>
                    ))}
                </div>
            </FieldGroup>

            {/* DOB + Blood Group */}
            <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Date of Birth" hint={age !== null ? `Age: ${age} years` : undefined}>
                    <CustomDatePicker
                        id="dob"
                        value={formData.dob}
                        onChange={(value) => update("dob", value)}
                        max={new Date().toISOString().split("T")[0]}
                        placeholder="Select date of birth"
                        suffix={
                            age !== null ? (
                                <span className="rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 text-xs font-bold text-[var(--primary-blue)]">
                                    {age} yrs
                                </span>
                            ) : null
                        }
                    />
                </FieldGroup>

                {/* Blood Group — visual pill selector */}
                <FieldGroup label="Blood Group">
                    <div className="grid grid-cols-4 gap-2">
                        {bloodGroups.map((bg) => (
                            <button
                                key={bg}
                                type="button"
                                onClick={() => update("bloodGroup", bg)}
                                className={`flex items-center justify-center rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                                    formData.bloodGroup === bg
                                        ? "border-red-400 bg-red-50 text-red-600 shadow-sm"
                                        : "border-[var(--line)] bg-white/70 text-[var(--muted)] hover:border-red-300 hover:bg-red-50/50 hover:text-red-500"
                                }`}
                                aria-pressed={formData.bloodGroup === bg}
                            >
                                {bg}
                            </button>
                        ))}
                    </div>
                </FieldGroup>
            </div>

            {/* Mobile + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup
                    label="Mobile Number"
                    required
                    validation={mobileStatus}
                >
                    <input
                        id="mobile"
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => update("mobile", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="form-input"
                        maxLength={10}
                        aria-required="true"
                    />
                </FieldGroup>
                <FieldGroup label="Email" validation={formData.email ? emailStatus : null}>
                    <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="patient@example.com"
                        className="form-input"
                    />
                </FieldGroup>
            </div>

            {/* Address */}
            <FieldGroup label="Address">
                <textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Full address"
                    rows={2}
                    className="form-input resize-none"
                />
            </FieldGroup>

            {/* Emergency Contact — split into 3 fields */}
            <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
                    </svg>
                    Emergency Contact
                </p>
                <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FieldGroup label="Contact Name" hint="Full name of emergency contact">
                            <input
                                id="emergencyContactName"
                                type="text"
                                value={formData.emergencyContactName}
                                onChange={(e) => update("emergencyContactName", e.target.value)}
                                placeholder="e.g. Priya Sharma"
                                className="form-input"
                            />
                        </FieldGroup>
                        <FieldGroup label="Relation" hint="Relationship to the patient">
                            <input
                                id="emergencyContactRelation"
                                type="text"
                                value={formData.emergencyContactRelation}
                                onChange={(e) => update("emergencyContactRelation", e.target.value)}
                                placeholder="e.g. Mother, Brother, Spouse"
                                className="form-input"
                            />
                        </FieldGroup>
                    </div>
                    <FieldGroup
                        label="Contact Number"
                        validation={emergencyContactStatus}
                        hint="10-digit mobile number"
                    >
                        <input
                            id="emergencyContactNumber"
                            type="tel"
                            value={formData.emergencyContactNumber}
                            onChange={(e) => update("emergencyContactNumber", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                            placeholder="10-digit mobile number"
                            className="form-input"
                            maxLength={10}
                        />
                    </FieldGroup>
                </div>
            </div>

            {/* Aadhaar Number */}
            <FieldGroup
                label="Aadhaar Number"
                hint="12-digit Aadhaar ID (compulsory)"
                required
                validation={aadhaarStatus}
            >
                <div className="relative">
                    <input
                        id="aadhaarNumber"
                        type="text"
                        value={formData.aadhaarNumber}
                        onChange={handleAadhaarChange}
                        placeholder="XXXX-XXXX-XXXX"
                        className="form-input pl-14 font-mono tracking-wider"
                        maxLength={14}
                        aria-required="true"
                    />
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/80">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <path d="M2 10h20" />
                        </svg>
                    </div>
                </div>
            </FieldGroup>
        </div>
    )
}

/** Reusable field wrapper with label, hint text, and validation status */
function FieldGroup({ label, required, hint, validation, children }) {
    return (
        <div>
            <label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-[var(--ink)]">
                {label}
                {required && <span className="text-red-400">*</span>}
            </label>
            {children}
            {hint && !validation && (
                <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
            )}
            {validation && validation.message && (
                <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                    validation.valid ? "text-emerald-600" : "text-amber-600"
                }`}>
                    <span>{validation.valid ? "✓" : "⚠"}</span>
                    {validation.message}
                </p>
            )}
        </div>
    )
}

export default StepBasicInfo
