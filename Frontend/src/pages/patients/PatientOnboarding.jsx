import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import Stepper from "../../components/modules/patients/Stepper"
import StepBasicInfo from "../../components/modules/patients/StepBasicInfo"
import StepMedicalInfo from "../../components/modules/patients/StepMedicalInfo"
import StepDoctorAssignment from "../../components/modules/patients/StepDoctorAssignment"
import StepReview from "../../components/modules/patients/StepReview"
import SuccessScreen from "../../components/modules/patients/SuccessScreen"
import { apiRequest } from "../../api/client"
import Modal from "../../components/common/Modal"
import Button from "../../components/common/Button"
import {
    createEmptyForm,
    saveDraft,
    loadDraft,
    clearDraft,
    validateMobile,
    validateEmail,
} from "../../utils/patientHelpers"

const TOTAL_STEPS = 4

function PatientOnboarding() {
    const navigate = useNavigate()
    const [currentStep, setCurrentStep] = useState(0)
    const [formData, setFormData] = useState(createEmptyForm)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [patientId, setPatientId] = useState("")
    const [verificationCode, setVerificationCode] = useState("")
    const [accountLoginId, setAccountLoginId] = useState("")
    const [temporaryPassword, setTemporaryPassword] = useState("")
    const [validationErrors, setValidationErrors] = useState([])
    const [showDraftModal, setShowDraftModal] = useState(false)
    const [toast, setToast] = useState(null)
    const isDirty = useRef(false)
    const toastTimer = useRef(null)

    // ── Draft Recovery ──────────────────────────────────────────────────
    useEffect(() => {
        const draft = loadDraft()
        if (draft && !submitted) {
            setShowDraftModal(true)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const restoreDraft = () => {
        const draft = loadDraft()
        if (draft) {
            // Remove internal keys
            const rest = { ...draft }
            delete rest._savedAt
            setFormData({ ...createEmptyForm(), ...rest })
            showToast("Draft restored successfully", "green")
        }
        setShowDraftModal(false)
    }

    const discardDraft = () => {
        clearDraft()
        setShowDraftModal(false)
    }

    // ── Auto-save draft ─────────────────────────────────────────────────
    useEffect(() => {
        if (!submitted && isDirty.current) {
            const timer = setTimeout(() => saveDraft(formData), 800)
            return () => clearTimeout(timer)
        }
    }, [formData, submitted])

    // ── Warn before leaving ─────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (isDirty.current && !submitted) {
                e.preventDefault()
                e.returnValue = ""
            }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [submitted])

    // ── Toast helper ────────────────────────────────────────────────────
    const showToast = useCallback((message, tone = "blue") => {
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setToast({ message, tone })
        toastTimer.current = setTimeout(() => setToast(null), 3500)
    }, [])

    // ── Form update ─────────────────────────────────────────────────────
    const handleFormChange = useCallback((newData) => {
        isDirty.current = true
        setFormData(newData)
        setValidationErrors([])
    }, [])

    // ── Validation ──────────────────────────────────────────────────────
    const validateStep = (step) => {
        const errors = []

        if (step === 0) {
            if (!formData.firstName.trim()) errors.push("First Name is required")
            if (!formData.lastName.trim()) errors.push("Last Name is required")
            const mobileResult = validateMobile(formData.mobile)
            if (!mobileResult.valid) errors.push("Valid 10-digit mobile number is required")
            if (!formData.gender) errors.push("Gender is required")
            if (!formData.dob) errors.push("Date of birth is required")
            if (!formData.email.trim()) errors.push("Email is required")
            else if (!validateEmail(formData.email).valid) errors.push("Valid email is required")
            if (!formData.address.trim()) errors.push("Address is required")
            if (!formData.bloodGroup) errors.push("Blood group is required")
            if (!formData.emergencyContactName.trim()) errors.push("Emergency contact name is required")
            if (!validateMobile(formData.emergencyContactNumber).valid) errors.push("Valid emergency contact number is required")
        }

        // Steps 1 and 2 have no hard-required fields
        // Step 3 is review — no validation needed

        return errors
    }

    // ── Navigation ──────────────────────────────────────────────────────
    const goNext = () => {
        const errors = validateStep(currentStep)
        if (errors.length > 0) {
            setValidationErrors(errors)
            showToast("Please fix the highlighted fields", "amber")
            return
        }
        setValidationErrors([])
        if (currentStep < TOTAL_STEPS - 1) {
            setCurrentStep((s) => s + 1)
            window.scrollTo({ top: 0, behavior: "smooth" })
        }
    }

    const goBack = () => {
        if (currentStep > 0) {
            setCurrentStep((s) => s - 1)
            setValidationErrors([])
            window.scrollTo({ top: 0, behavior: "smooth" })
        }
    }

    // ── Submission ──────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setShowConfirmModal(false)
        setIsSubmitting(true)

        try {
            const created = await apiRequest("/patients", {
                method: "POST",
                body: JSON.stringify({
                    full_name: `${formData.firstName} ${formData.lastName}`.trim(),
                    gender: formData.gender,
                    date_of_birth: formData.dob,
                    phone: formData.mobile.replace(/\D/g, ""),
                    email: formData.email.trim(),
                    address: formData.address.trim(),
                    blood_group: formData.bloodGroup,
                    emergency_contact_name: formData.emergencyContactName.trim(),
                    emergency_contact_phone: formData.emergencyContactNumber.replace(/\D/g, ""),
                    allergies: formData.allergies,
                    medical_history: [...formData.chronicDiseases, ...formData.medications, ...(formData.medicalNotes ? [formData.medicalNotes] : [])],
                    // The doctor chosen in the assignment step is persisted, so the
                    // patient appears on that clinician's list straight away.
                    ...(formData.assignedDoctorId ? { assigned_doctor_id: formData.assignedDoctorId } : {}),
                }),
            })
            setPatientId(created.patient_id)
            setVerificationCode("Backend record created")
            setAccountLoginId(created.account_login_id || "")
            setTemporaryPassword(created.temporary_password || "")
            setSubmitted(true)
            clearDraft()
            isDirty.current = false
        } catch (error) {
            const apiDetails = Array.isArray(error.payload?.detail) ? error.payload.detail : []
            const detailErrors = [...(error.payload?.errors || []), ...apiDetails]
                .filter((item) => item && typeof item === "object")
                .map((item) => `${item.loc?.slice(-1)[0] || "Field"}: ${item.msg || "Invalid value"}`)
            const detailMessage = typeof error.payload?.detail === "string" ? error.payload.detail : ""
            setValidationErrors(detailErrors.length ? detailErrors : [detailMessage || error.message || "Patient registration failed."])
            showToast("Registration failed", "amber")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRegisterAnother = () => {
        setFormData(createEmptyForm())
        setCurrentStep(0)
        setSubmitted(false)
        setPatientId("")
        setVerificationCode("")
        isDirty.current = false
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    // ── Render step content ─────────────────────────────────────────────
    const renderStep = () => {
        if (submitted) {
            return (
                <SuccessScreen
                    formData={formData}
                    patientId={patientId}
                    verificationCode={verificationCode}
                    accountLoginId={accountLoginId}
                    temporaryPassword={temporaryPassword}
                    onRegisterAnother={handleRegisterAnother}
                    onViewPatient={() => navigate("/admin/patients")}
                />
            )
        }

        switch (currentStep) {
            case 0:
                return <StepBasicInfo formData={formData} onChange={handleFormChange} />
            case 1:
                return <StepMedicalInfo formData={formData} onChange={handleFormChange} />
            case 2:
                return <StepDoctorAssignment formData={formData} onChange={handleFormChange} />
            case 3:
                return <StepReview formData={formData} />
            default:
                return null
        }
    }

    return (
        <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    <h1 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">
                        {submitted ? "Registration Complete" : "Register New Patient"}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                        {submitted
                            ? "Patient has been registered into CareOS"
                            : "Complete all steps to onboard a new patient into CareOS"
                        }
                    </p>
                </div>
                {!submitted && isDirty.current && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Draft saved
                    </span>
                )}
            </div>

            {/* Stepper */}
            {!submitted && <Stepper currentStep={currentStep} />}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
                <div className="anim-fade-in-up mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="mb-1 text-sm font-semibold text-red-700">Please fix the following:</p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-red-600">
                        {validationErrors.map((err) => (
                            <li key={err}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Loading overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                    <div className="anim-scale-in flex flex-col items-center gap-4 rounded-3xl bg-white px-10 py-8 shadow-xl">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--primary-blue)]" />
                        <p className="font-display text-xl text-[var(--ink)]">Registering Patient…</p>
                        <p className="text-sm text-[var(--muted)]">Generating ID and setting up profile</p>
                    </div>
                </div>
            )}

            {/* Step content */}
            <div key={submitted ? "success" : currentStep}>
                {renderStep()}
            </div>

            {/* Navigation buttons */}
            {!submitted && (
                <div className="mt-8 flex items-center justify-between border-t border-[var(--line)]/50 pt-6">
                    <div>
                        {currentStep > 0 && (
                            <Button variant="subtle" onClick={goBack}>
                                <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Previous
                            </Button>
                        )}
                    </div>
                    <div>
                        {currentStep < TOTAL_STEPS - 1 ? (
                            <Button onClick={goNext}>
                                Next Step
                                <svg viewBox="0 0 24 24" className="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </Button>
                        ) : (
                            <Button onClick={() => setShowConfirmModal(true)}>
                                <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                                Generate Patient ID
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation modal */}
            <Modal
                open={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title="Confirm Registration"
                eyebrow="Patient Onboarding"
            >
                <div className="space-y-4">
                    <p>
                        You are about to register <strong>{formData.firstName} {formData.lastName}</strong> as a new patient.
                        This will generate a unique Patient ID and initialize their profile in CareOS.
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                        This action will trigger: profile creation, ID generation, doctor assignment, medical record setup,
                        credential generation, QR code, and notifications (SMS, WhatsApp, Email).
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <Button variant="subtle" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>Confirm & Generate ID</Button>
                    </div>
                </div>
            </Modal>

            {/* Draft recovery modal */}
            <Modal
                open={showDraftModal}
                onClose={discardDraft}
                title="Recover Draft?"
                eyebrow="Draft Found"
            >
                <div className="space-y-4">
                    <p>
                        A previously saved registration draft was found. Would you like to continue where you left off?
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <Button variant="subtle" onClick={discardDraft}>Start Fresh</Button>
                        <Button onClick={restoreDraft}>Restore Draft</Button>
                    </div>
                </div>
            </Modal>

            {/* Toast notification */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                    <div className={`anim-toast flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg ${
                        toast.tone === "green"
                            ? "bg-emerald-600 text-white"
                            : toast.tone === "amber"
                                ? "bg-amber-500 text-white"
                                : "bg-[var(--primary-blue)] text-white"
                    }`}>
                        {toast.tone === "green" && "✓"}
                        {toast.tone === "amber" && "⚠"}
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    )
}

export default PatientOnboarding
