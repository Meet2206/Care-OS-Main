// ── Patient Onboarding Helpers ──────────────────────────────────────────

const DRAFT_KEY = "careos-patient-draft"

/**
 * Generate a simulated Patient ID in format PAT-YYYY-XXXXXX
 */
export function generatePatientId() {
    const year = new Date().getFullYear()
    const seq = String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0")
    return `PAT-${year}-${seq}`
}

/**
 * Generate a simulated verification code in format MLEIET-XXX-XXXX
 */
export function generateVerificationCode() {
    const num = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
    const hex = Math.random().toString(16).substring(2, 6).toUpperCase()
    return `MLEIET-${num}-${hex}`
}

/**
 * Calculate age from date-of-birth string (YYYY-MM-DD)
 */
export function calculateAge(dob) {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--
    }
    return age >= 0 ? age : null
}

/**
 * Validate a 10-digit mobile number
 */
export function validateMobile(number) {
    if (!number) return { valid: false, message: "" }
    const digits = number.replace(/\D/g, "")
    if (digits.length === 0) return { valid: false, message: "" }
    if (digits.length < 10) return { valid: false, message: "Enter a valid 10-digit number" }
    if (digits.length === 10) return { valid: true, message: "Mobile number valid" }
    return { valid: false, message: "Number exceeds 10 digits" }
}

/**
 * Validate an email address
 */
export function validateEmail(email) {
    if (!email) return { valid: true, message: "" }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (re.test(email)) return { valid: true, message: "Email valid" }
    return { valid: false, message: "Enter a valid email address" }
}

/**
 * Check for duplicate patients by mobile or email
 */
export function checkDuplicatePatient(mobile, email, existingPatients) {
    const digits = (mobile || "").replace(/\D/g, "")
    const warnings = []

    if (digits.length === 10) {
        const match = existingPatients.find((p) => p.mobile.replace(/\D/g, "") === digits)
        if (match) warnings.push({ field: "mobile", patient: match })
    }

    if (email && validateEmail(email).valid) {
        const match = existingPatients.find(
            (p) => p.email && p.email.toLowerCase() === email.toLowerCase(),
        )
        if (match) warnings.push({ field: "email", patient: match })
    }

    return warnings
}

/**
 * Save form draft to localStorage
 */
export function saveDraft(formData) {
    try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, _savedAt: Date.now() }))
    } catch {
        // localStorage full or unavailable — silently skip
    }
}

/**
 * Load form draft from localStorage
 */
export function loadDraft() {
    try {
        const raw = window.localStorage.getItem(DRAFT_KEY)
        if (!raw) return null
        const data = JSON.parse(raw)
        // Drafts older than 24 hours are considered stale
        if (Date.now() - (data._savedAt || 0) > 86400000) {
            clearDraft()
            return null
        }
        return data
    } catch {
        return null
    }
}

/**
 * Clear form draft from localStorage
 */
export function clearDraft() {
    try {
        window.localStorage.removeItem(DRAFT_KEY)
    } catch {
        // silently skip
    }
}

/**
 * Create initial empty form state
 */
export function createEmptyForm() {
    return {
        // Step 1 — Basic Info
        firstName: "",
        lastName: "",
        gender: "",
        dob: "",
        bloodGroup: "",
        mobile: "",
        email: "",
        address: "",
        emergencyContactName: "",
        emergencyContactRelation: "",
        emergencyContactNumber: "",
        aadhaarNumber: "",

        // Step 2 — Medical Info
        height: "",
        weight: "",
        allergies: [],
        chronicDiseases: [],
        medications: [],
        medicalNotes: "",

        // Step 3 — Doctor Assignment
        assignedDoctor: "",
        appointmentType: "",
    }
}
