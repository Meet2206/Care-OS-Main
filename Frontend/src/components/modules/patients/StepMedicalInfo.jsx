import TagInput from "./TagInput"
import { commonAllergies, chronicDiseasesList } from "../../../data/mockData"

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

function StepMedicalInfo({ formData, onChange }) {
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
            <TagInput
                label="Chronic Diseases"
                id="chronicDiseases"
                value={formData.chronicDiseases}
                onChange={(v) => update("chronicDiseases", v)}
                suggestions={chronicDiseasesList}
                placeholder="Type a condition and press Enter…"
            />

            {/* Current Medications */}
            <TagInput
                label="Current Medications"
                id="medications"
                value={formData.medications}
                onChange={(v) => update("medications", v)}
                suggestions={commonMedications}
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
