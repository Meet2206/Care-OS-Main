const STEP_LABELS = ["Basic Information", "Medical Information", "Doctor Assignment", "Review & Submit"]

function Stepper({ currentStep }) {
    return (
        <div className="mb-8" role="navigation" aria-label="Registration progress">
            {/* Desktop stepper */}
            <div className="hidden sm:block">
                <div className="relative flex items-center justify-between">
                    {/* Background track */}
                    <div className="absolute left-0 right-0 top-5 h-1 rounded-full bg-[var(--line)]" />
                    {/* Filled track */}
                    <div
                        className="absolute left-0 top-5 h-1 rounded-full bg-[var(--primary-blue)] transition-all duration-500 ease-out"
                        style={{ width: `${(currentStep / (STEP_LABELS.length - 1)) * 100}%` }}
                    />

                    {STEP_LABELS.map((label, index) => {
                        const isCompleted = index < currentStep
                        const isCurrent = index === currentStep
                        const isFuture = index > currentStep

                        return (
                            <div key={label} className="relative z-10 flex flex-col items-center gap-2">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                                        isCompleted
                                            ? "border-[var(--primary-blue)] bg-[var(--primary-blue)] text-white"
                                            : isCurrent
                                                ? "stepper-pulse border-[var(--primary-blue)] bg-white text-[var(--primary-blue)]"
                                                : "border-[var(--line)] bg-white text-[var(--muted)]"
                                    }`}
                                    aria-current={isCurrent ? "step" : undefined}
                                >
                                    {isCompleted ? (
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        index + 1
                                    )}
                                </div>
                                <span
                                    className={`max-w-[100px] text-center text-xs font-semibold transition-colors duration-300 ${
                                        isFuture ? "text-[var(--muted)]/60" : "text-[var(--ink)]"
                                    }`}
                                >
                                    {label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Mobile stepper — compact pill */}
            <div className="flex items-center gap-3 sm:hidden">
                <div className="flex items-center gap-1.5">
                    {STEP_LABELS.map((label, index) => (
                        <div
                            key={label}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                index <= currentStep ? "w-8 bg-[var(--primary-blue)]" : "w-2 bg-[var(--line)]"
                            }`}
                            title={label}
                        />
                    ))}
                </div>
                <span className="text-xs font-semibold text-[var(--muted)]">
                    Step {currentStep + 1} of {STEP_LABELS.length}
                </span>
            </div>
        </div>
    )
}

export default Stepper
