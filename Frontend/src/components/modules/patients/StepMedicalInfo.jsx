import TagInput from "./TagInput"
import { commonAllergies, doctorDiseaseOptions } from "../../../data/mockData"

const commonMedications = [
    "Paracetamol 500mg",
    "Metformin 500mg",
    "Amlodipine 5mg",
    "Atorvastatin 10mg",
    "Pantoprazole 40mg",
    "Cetirizine 10mg",
    "Azithromycin 250mg",
    "Insulin Glargine",
    "Levothyroxine 50mcg",
    "Salbutamol Inhaler",
]

// Common medication suggestions sourced from Dataset/Medicine_Details.csv.
// This is only a quick-entry list; the doctor can still type any medicine.
const datasetMedicationNames = [
    "Avastin 400mg Injection", "Augmentin 625 Duo Tablet", "Azithral 500 Tablet",
    "Ascoril LS Syrup", "Aciloc 150 Tablet", "Allegra 120mg Tablet", "Avil 25 Tablet",
    "Aricep 5 Tablet", "Amoxyclav 625 Tablet", "Atarax 25mg Tablet", "Azee 500 Tablet",
    "Anovate Cream", "Allegra-M Tablet", "Ascoril D Plus Syrup Sugar Free", "Alex Syrup",
    "Armotraz Tablet", "Augmentin Duo Oral Suspension", "Albendazole 400mg Tablet",
    "Arkamin Tablet", "Allegra 180mg Tablet", "Altraday Capsule SR", "Atarax 10mg Tablet",
    "Aldigesic-SP Tablet", "Aldactone Tablet", "Aricep 10 Tablet", "Aricep-M Tablet",
    "Andre I-Kul Eye Drop", "Anafortan 25 mg/300 mg Tablet", "Atarax Syrup", "Ambrodil-S Syrup",
    "Asthakind-DX Syrup Sugar Free", "Aceclo Plus Tablet", "Althrocin 500 Tablet", "Asthalin Syrup",
    "Axcer 90mg Tablet", "Arachitol 6L Injection", "Alfoo 10mg Tablet PR", "Azithral 200 Liquid",
    "Acemiz Plus Tablet", "Allegra Suspension", "Alex Junior Syrup", "Azicip 500 Tablet",
    "Avil Injection", "Aquasol A Capsule", "Anobliss Cream", "Augmentin DDS Suspension",
    "Almox 500 Capsule", "AF Kit Tablet", "Ascoril LS Junior Syrup", "Asthalin 100mcg Inhaler",
    "Aptimust Syrup", "AB Phylline Capsule", "Azee 200mg Dry Syrup", "Adaferin Gel",
    "Amitone 10mg Tablet", "Ambrodil Syrup", "AB-Flo-N Tablet", "Ascoril LS Drops",
    "Alex Cough Lozenges Lemon Ginger", "Atorva 40 Tablet", "Aziderm 20% Cream",
    "Ascoril D Junior Cough Syrup", "Acogut Tablet", "Augmentin 1000 Duo Tablet",
    "Ano Metrogyl Cream", "Angispan-TR 2.5mg Capsule", "Apdrops Eye Drop", "Acivir 400 DT Tablet",
    "Acivir Cream", "Azee 250 Tablet", "Aldigesic P 100mg/325mg Tablet", "Acitrom 2 Tablet",
    "Alerid Syrup", "Atorva Tablet", "Azax 500 Tablet", "Aztor 10 Tablet", "Amifru 40 Tablet",
    "Aciloc 300 Tablet",
]

function StepMedicalInfo({ formData, onChange }) {
    const diseaseSuggestions = doctorDiseaseOptions[formData.assignedDoctorDepartment] || []

    const update = (field, value) => {
        onChange({ ...formData, [field]: value })
    }

    return (
        <div className="anim-fade-in-up space-y-6">
            <div>
                <h2 className="font-display text-2xl text-[var(--ink)] sm:text-3xl">Medical Information</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                    Health history, allergies, and current medications
                </p>
            </div>

            {/* Height & Weight */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="height" className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                        Height
                    </label>
                    <div className="relative">
                        <input
                            id="height"
                            type="text"
                            inputMode="numeric"
                            value={formData.height}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3)
                                update("height", v)
                            }}
                            placeholder="e.g. 170"
                            className="form-input pr-14"
                            maxLength={3}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-[var(--primary-blue)]/10 px-2 py-0.5 text-xs font-bold text-[var(--primary-blue)]">
                            cm
                        </span>
                    </div>
                </div>
                <div>
                    <label htmlFor="weight" className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                        Weight
                    </label>
                    <div className="relative">
                        <input
                            id="weight"
                            type="text"
                            inputMode="numeric"
                            value={formData.weight}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, "").slice(0, 5)
                                update("weight", v)
                            }}
                            placeholder="e.g. 70"
                            className="form-input pr-14"
                            maxLength={5}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-[var(--primary-blue)]/10 px-2 py-0.5 text-xs font-bold text-[var(--primary-blue)]">
                            kg
                        </span>
                    </div>
                    {formData.height && formData.weight && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                            BMI: {(formData.weight / ((formData.height / 100) ** 2)).toFixed(1)}
                        </p>
                    )}
                </div>
            </div>

            {/* Allergies */}
            <TagInput
                label="Allergies"
                id="allergies"
                value={formData.allergies}
                onChange={(v) => update("allergies", v)}
                suggestions={commonAllergies}
                placeholder="Type an allergy and press Enter…"
            />

            {/* Chronic Diseases */}
            <div>
                <TagInput
                    label="Doctor-specific Diseases"
                    id="chronicDiseases"
                    value={formData.chronicDiseases}
                    onChange={(v) => update("chronicDiseases", v)}
                    suggestions={diseaseSuggestions}
                    placeholder={formData.assignedDoctor ? "Search diseases for the selected doctor…" : "Select a doctor first"}
                />
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {formData.assignedDoctor
                        ? `Suggestions are based on ${formData.assignedDoctor}'s department. You may also enter another documented condition.`
                        : "Choose a doctor in the next step to load specialty-specific disease options."}
                </p>
            </div>

            {/* Current Medications */}
            <TagInput
                label="Current Medications"
                id="medications"
                value={formData.medications}
                onChange={(v) => update("medications", v)}
                suggestions={[...commonMedications, ...datasetMedicationNames]}
                placeholder="Type a medication and press Enter…"
            />

            {/* Medical Notes */}
            <div>
                <label htmlFor="medicalNotes" className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                    Medical Notes
                </label>
                <textarea
                    id="medicalNotes"
                    value={formData.medicalNotes}
                    onChange={(e) => update("medicalNotes", e.target.value)}
                    placeholder="Any additional medical notes, observations, or special instructions…"
                    rows={4}
                    className="form-input resize-none"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                    Include any relevant history, surgical notes, or observations
                </p>
            </div>
        </div>
    )
}

export default StepMedicalInfo
