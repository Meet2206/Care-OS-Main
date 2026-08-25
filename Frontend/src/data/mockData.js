export const roleOptions = {
    admin: {
        email: "admin@careos.com",
        name: "Admin Deer",
        title: "Hospital Operations Lead",
        dashboardPath: "/admin",
    },
    doctor: {
        email: "doctor@careos.com",
        name: "Dr. Anya Sharma",
        title: "Consultant Physician",
        dashboardPath: "/doctor",
    },
    patient: {
        email: "patient@careos.com",
        name: "John Doe",
        title: "Patient Portal",
        dashboardPath: "/patient",
    },
    pharmacy: {
        email: "pharmacy@careos.com",
        name: "Meera Rao",
        title: "Pharmacy Operations",
        dashboardPath: "/pharmacy",
    },
}

export const adminMetrics = [
    { label: "Doctors with specialization", value: "145", note: "Across 12 departments" },
    { label: "Total Patients", value: "3,890", note: "412 admitted today" },
    { label: "Appointments Today", value: "210", note: "18 in triage queue" },
    { label: "Active Units", value: "18", note: "2 on limited staffing" },
]

export const adminPanels = {
    specialization: [
        { label: "Cardiology", value: 24 },
        { label: "Neurology", value: 16 },
        { label: "Orthopedics", value: 21 },
        { label: "Emergency", value: 32 },
    ],
    systemLogs: [
        "07:37 PM - Administration system sync completed",
        "07:12 PM - CareAI note review queue updated",
        "06:58 PM - Lab dashboard refreshed",
        "06:30 PM - New referral packet generated",
    ],
    operationalItems: [
        { label: "Patients in wards", value: 9 },
        { label: "Needs doctor review", value: 3 },
        { label: "Pending discharge", value: 6 },
    ],
    departments: [
        { name: "Cardiology", doctors: 24, queue: "Moderate", status: "Stable" },
        { name: "Neurology", doctors: 16, queue: "High", status: "Needs support" },
        { name: "Orthopedics", doctors: 21, queue: "Low", status: "Stable" },
    ],
    doctors: [
        { name: "Dr. Anya Sharma", department: "Cardiology", mode: "On duty" },
        { name: "Dr. Aaron Mehta", department: "Radiology", mode: "In rounds" },
        { name: "Dr. Noor Siddiqui", department: "Neurology", mode: "Available soon" },
    ],
}

export const doctorSchedule = [
    { time: "09:00", patient: "John Doe", reason: "Consult", status: "Confirmed" },
    { time: "10:30", patient: "Maria Garcia", reason: "Follow-up", status: "Arrived" },
    { time: "12:30", patient: "Riya Kapoor", reason: "Lab review", status: "Pending" },
    { time: "13:30", patient: "David Chen", reason: "Consult", status: "Confirmed" },
]

export const assignedPatients = [
    { id: "P001", name: "David Chen", ward: "Ward 3A/301" },
    { id: "P002", name: "Sarah Lee", ward: "Room 412" },
    { id: "P003", name: "Noah Patel", ward: "Observation 12" },
    { id: "P004", name: "Ava Khan", ward: "ICU Step-down" },
]

export const doctorReportOptions = [
    "No report required",
    "CBC",
    "Urine Routine",
    "Liver Function Test",
    "Kidney Function Test",
    "Chest X-Ray",
    "MRI Brain",
    "ECG",
]

export const doctorMedicineOptions = [
    "Paracetamol 500mg",
    "Azithromycin 250mg",
    "Pantoprazole 40mg",
    "Cetirizine 10mg",
    "Metformin 500mg",
    "Atorvastatin 10mg",
    "Amoxicillin 500mg",
    "Telmisartan 40mg",
    "Calcium + Vitamin D3",
    "Ondansetron 4mg",
    "Levocetirizine 5mg",
    "Dolo 650mg",
    "Rabeprazole 20mg",
]

export const doctorPrescribingCatalog = {
    "Dr. Anya Sharma": [
        "Aspirin 75mg",
        "Atorvastatin 10mg",
        "Metoprolol 25mg",
        "Pantoprazole 40mg",
        "Paracetamol 500mg",
        "Telmisartan 40mg",
        "Dolo 650mg",
    ],
    "Dr. Aaron Mehta": [
        "Pantoprazole 40mg",
        "Paracetamol 500mg",
        "Cetirizine 10mg",
        "Ondansetron 4mg",
        "Levocetirizine 5mg",
    ],
    "Dr. Noor Siddiqui": [
        "Gabapentin 300mg",
        "Paracetamol 500mg",
        "Pantoprazole 40mg",
        "Methylcobalamin 1500mcg",
        "Calcium + Vitamin D3",
        "Rabeprazole 20mg",
    ],
}

export const patientAppointments = [
    { date: "Oct 28", time: "14:00", doctor: "Dr. Anya Sharma", specialty: "Cardiology", location: "Clinic B", status: "Rescheduling" },
    { date: "Nov 03", time: "09:30", doctor: "Dr. Aaron Mehta", specialty: "Radiology", location: "Imaging 2", status: "Scheduled" },
]

export const careTeam = [
    { name: "Dr. Anya Sharma", role: "Primary Doctor" },
    { name: "Kenny Masia", role: "Respiratory Therapist" },
    { name: "Aarmei Rankey", role: "Care Coordinator" },
]

export const doctorDirectory = [
    { name: "Dr. Anya Sharma", specialty: "Cardiology", location: "Clinic B" },
    { name: "Dr. Aaron Mehta", specialty: "Radiology", location: "Imaging 2" },
    { name: "Dr. Noor Siddiqui", specialty: "Neurology", location: "Consult Room 4" },
    { name: "Dr. Kavya Rao", specialty: "General Medicine", location: "Clinic A" },
]

export const appointmentTimeSlots = [
    { time: "11:00 AM", status: "booked" },
    { time: "11:30 AM", status: "available" },
    { time: "12:00 PM", status: "booked" },
    { time: "12:30 PM", status: "available" },
    { time: "01:00 PM", status: "available" },
    { time: "01:30 PM", status: "booked" },
    { time: "02:00 PM", status: "available" },
    { time: "02:30 PM", status: "available" },
    { time: "03:00 PM", status: "booked" },
    { time: "03:30 PM", status: "available" },
    { time: "04:00 PM", status: "available" },
    { time: "04:30 PM", status: "available" },
    { time: "05:00 PM", status: "available" },
]

export const patientProfile = {
    id: "JOH-DOE-3210",
    phone: "+91 98765 43210",
    bloodGroup: "B+",
    insurance: "Active",
    assistance: "Wheelchair support on request",
}

export const appointmentUpdates = [
    { title: "Booking confirmed", detail: "Cardiology follow-up remains on Nov 03 at 09:30 AM.", tone: "green" },
    { title: "Slot changed", detail: "Oct 28 visit moved to 02:15 PM. Confirmed from app.", tone: "amber" },
    { title: "Advance paid", detail: "25% consultation booking charge received.", tone: "blue" },
]

export const patientSupportOptions = [
    { id: "wheelchair", label: "Wheelchair assistance", detail: "Ask reception to keep mobility support ready." },
    { id: "elderly", label: "Elderly support", detail: "Request guided check-in and priority desk support." },
    { id: "visual", label: "Visual assistance", detail: "Flag larger text and front-desk escort support." },
]

export const prescriptionOrders = [
    {
        id: "RX-104",
        medicine: "Atorvastatin 10mg",
        quantity: "10 tablets",
        mode: "Pickup",
        status: "Ready",
    },
    {
        id: "RX-105",
        medicine: "Metformin 500mg",
        quantity: "5 tablets of 10",
        mode: "Scheduled delivery",
        status: "Pending payment",
    },
]

export const medicalRecords = [
    {
        id: 1,
        date: "Oct 15",
        type: "Consultation Summary",
        doctor: "Dr. Sharma",
        doctorFull: "Dr. Anya Sharma",
        summary: "Vital signs stable. Continue medication and review symptoms after seven days.",
    },
    {
        id: 2,
        date: "Sep 30",
        type: "Lab Results",
        doctor: "Lab Tech",
        doctorFull: "Central Diagnostics",
        summary: "CBC and lipid panel reviewed. No urgent abnormal values flagged.",
    },
    {
        id: 3,
        date: "Sep 10",
        type: "Imaging Review",
        doctor: "Dr. Mehta",
        doctorFull: "Dr. Aaron Mehta",
        summary: "Chest imaging unchanged from prior scan. Follow-up in four weeks recommended.",
    },
]

export const careAiMessages = [
    { id: 1, sender: "ai", text: "Hi. How can I help you review today's patient updates?" },
    { id: 2, sender: "user", text: "Summarize any follow-ups that need my attention." },
    { id: 3, sender: "ai", text: "Three follow-ups are pending: one lab review, one discharge check, and one cardiology consult reschedule." },
]

export const patientDirectory = [
    {
        id: "P001",
        name: "John Doe",
        age: 42,
        ward: "Ward 3A / Room 301",
        complaint: "Chest discomfort follow-up",
        lastVisit: "Oct 15",
        status: "Under review",
    },
    {
        id: "P002",
        name: "Sarah Lee",
        age: 35,
        ward: "Room 412",
        complaint: "Post-surgery recovery check",
        lastVisit: "Oct 18",
        status: "Stable",
    },
    {
        id: "P003",
        name: "Noah Patel",
        age: 57,
        ward: "Observation 12",
        complaint: "Blood pressure monitoring",
        lastVisit: "Oct 21",
        status: "Needs review",
    },
    {
        id: "P004",
        name: "Ava Khan",
        age: 28,
        ward: "ICU Step-down",
        complaint: "Respiratory follow-up",
        lastVisit: "Oct 22",
        status: "Improving",
    },
]

export const pharmacyOrders = [
    {
        token: "PH-2104",
        patient: "John Doe",
        patientId: "JOH-DOE-3210",
        items: 3,
        mode: "Pickup",
        status: "Ready to dispense",
    },
    {
        token: "PH-2105",
        patient: "Sarah Lee",
        patientId: "SAR-LEE-1042",
        items: 2,
        mode: "Delivery",
        status: "Packed",
    },
    {
        token: "PH-2106",
        patient: "Noah Patel",
        patientId: "NOA-PAT-8891",
        items: 1,
        mode: "Partial refill",
        status: "Awaiting balance",
    },
]

export const pharmacyAlerts = [
    "2 QR pickups are waiting at counter 1.",
    "1 partial refill is pending balance confirmation.",
    "Cold-chain medicine dispatch closes at 7:30 PM.",
]

// ── Patient Onboarding ─────────────────────────────────────────────────

export const existingPatients = [
    {
        id: "PAT-2026-000101",
        name: "John Doe",
        mobile: "9876543210",
        email: "john.doe@example.com",
        bloodGroup: "B+",
        doctor: "Dr. Anya Sharma",
        status: "Active",
    },
    {
        id: "PAT-2026-000102",
        name: "Sarah Lee",
        mobile: "9123456780",
        email: "sarah.lee@example.com",
        bloodGroup: "A+",
        doctor: "Dr. Aaron Mehta",
        status: "Follow-up",
    },
    {
        id: "PAT-2026-000103",
        name: "Noah Patel",
        mobile: "9988776655",
        email: "noah.p@example.com",
        bloodGroup: "O+",
        doctor: "Dr. Noor Siddiqui",
        status: "Active",
    },
    {
        id: "PAT-2026-000104",
        name: "Ava Khan",
        mobile: "9001122334",
        email: "ava.khan@example.com",
        bloodGroup: "AB-",
        doctor: "Dr. Kavya Rao",
        status: "Discharged",
    },
    {
        id: "PAT-2026-000105",
        name: "Riya Kapoor",
        mobile: "9112233445",
        email: "riya.k@example.com",
        bloodGroup: "O-",
        doctor: "Dr. Anya Sharma",
        status: "Active",
    },
]

export const doctorsList = [
    { name: "Dr. Anya Sharma", specialty: "Cardiology", location: "Clinic B", available: true },
    { name: "Dr. Aaron Mehta", specialty: "Radiology", location: "Imaging 2", available: true },
    { name: "Dr. Noor Siddiqui", specialty: "Neurology", location: "Consult Room 4", available: true },
    { name: "Dr. Kavya Rao", specialty: "General Medicine", location: "Clinic A", available: true },
    { name: "Dr. Priya Desai", specialty: "Orthopedics", location: "Ward 5B", available: false },
    { name: "Dr. Rahul Verma", specialty: "Dermatology", location: "Clinic C", available: true },
    { name: "Dr. Meena Iyer", specialty: "Pediatrics", location: "Children's Wing", available: true },
]

export const commonAllergies = [
    "Peanut Allergy",
    "Penicillin",
    "Sulfa Drugs",
    "Aspirin",
    "Latex",
    "Shellfish",
    "Dairy",
    "Gluten",
    "Dust Mites",
    "Pollen",
    "Bee Stings",
    "Soy",
    "Egg",
    "Ibuprofen",
    "Codeine",
]

export const chronicDiseasesList = [
    "Diabetes",
    "Hypertension",
    "Asthma",
    "COPD",
    "Coronary Artery Disease",
    "Chronic Kidney Disease",
    "Arthritis",
    "Thyroid Disorder",
    "Epilepsy",
    "Heart Failure",
    "Liver Cirrhosis",
    "Depression",
    "Anxiety Disorder",
    "Osteoporosis",
]

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

export const appointmentTypes = [
    { value: "general", label: "General", icon: "🩺", description: "Routine check-up or new consultation" },
    { value: "emergency", label: "Emergency", icon: "🚨", description: "Urgent medical attention required" },
    { value: "followup", label: "Follow-up", icon: "🔄", description: "Continue previous treatment plan" },
    { value: "consultation", label: "Consultation", icon: "💬", description: "Specialist opinion or second opinion" },
]

export const patientStatuses = [
    { value: "active", label: "Active", color: "green" },
    { value: "followup", label: "Follow-up", color: "blue" },
    { value: "discharged", label: "Discharged", color: "amber" },
    { value: "inactive", label: "Inactive", color: "neutral" },
]
