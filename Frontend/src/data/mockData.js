// Static UI options only. Clinical data is loaded from the API.
export const appointmentUpdates = []
export const careTeam = []
export const pharmacyAlerts = []
export const existingPatients = []
export const doctorsList = []
export const patientProfile = {
    id: "—",
    phone: "Not provided",
    bloodGroup: "Not provided",
    insurance: "Not provided",
    assistance: "Contact reception for assistance",
}

export const patientSupportOptions = [
    { id: "wheelchair", label: "Wheelchair assistance", detail: "Request mobility support from reception." },
    { id: "elderly", label: "Elderly support", detail: "Request guided check-in and priority desk support." },
    { id: "visual", label: "Visual assistance", detail: "Request larger text and front-desk escort support." },
]

export const doctorReportOptions = [
    "No report required", "CBC", "Urine Routine", "Liver Function Test",
    "Kidney Function Test", "Chest X-Ray", "MRI Brain", "ECG",
]

export const commonAllergies = [
    "Peanut Allergy", "Penicillin", "Sulfa Drugs", "Aspirin", "Latex",
    "Shellfish", "Dairy", "Gluten", "Dust Mites", "Pollen", "Bee Stings",
    "Soy", "Egg", "Ibuprofen", "Codeine",
]

export const chronicDiseasesList = [
    "Diabetes", "Hypertension", "Asthma", "COPD", "Coronary Artery Disease",
    "Chronic Kidney Disease", "Arthritis", "Thyroid Disorder", "Epilepsy",
    "Heart Failure", "Liver Cirrhosis", "Depression", "Anxiety Disorder",
    "Osteoporosis",
]

// Clinical suggestions are scoped to the clinician selected during onboarding.
// Staff can still type a condition that is not in the suggestions.
export const doctorDiseaseOptions = {
    "Cardiology": ["Hypertension", "Coronary Artery Disease", "Heart Failure", "Arrhythmia", "Hyperlipidemia"],
    "Neurology": ["Migraine", "Epilepsy", "Parkinson's Disease", "Multiple Sclerosis", "Neuropathy"],
    "Pediatrics": ["Asthma", "Allergic Rhinitis", "Atopic Dermatitis", "Iron Deficiency Anemia", "Febrile Seizures"],
    "Orthopedics": ["Osteoarthritis", "Rheumatoid Arthritis", "Osteoporosis", "Cervical Spondylosis", "Low Back Pain"],
    "Obstetrics & Gynaecology": ["Polycystic Ovary Syndrome", "Endometriosis", "Gestational Diabetes", "Anemia in Pregnancy", "Uterine Fibroids"],
    "General Medicine": ["Diabetes", "Hypertension", "Asthma", "COPD", "Thyroid Disorder", "Chronic Kidney Disease"],
    "Dermatology": ["Psoriasis", "Eczema", "Acne", "Urticaria", "Fungal Skin Infection", "Vitiligo"],
}

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

export const appointmentTypes = [
    { value: "general", label: "General", icon: "🩺", description: "Routine check-up or new consultation" },
    { value: "emergency", label: "Emergency", icon: "🚨", description: "Urgent medical attention required" },
    { value: "followup", label: "Follow-up", icon: "🔄", description: "Continue previous treatment plan" },
    { value: "consultation", label: "Consultation", icon: "💬", description: "Specialist opinion or second opinion" },
]
