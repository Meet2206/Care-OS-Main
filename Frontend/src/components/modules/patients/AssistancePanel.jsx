import Card from "../../common/Card"
import StatusPill from "../../common/StatusPill"

function AssistancePanel({ options, selectedOption, onSelect }) {
    return (
        <Card className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-display text-3xl text-[var(--ink)]">Visit Assistance</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        Tell the hospital if you need wheelchair or arrival support before your appointment.
                    </p>
                </div>
                {selectedOption ? <StatusPill tone="blue">Requested</StatusPill> : null}
            </div>

            <div className="mt-5 grid gap-3">
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelect(option.label)}
                        className={`rounded-[24px] border px-4 py-4 text-left ${
                            selectedOption === option.label
                                ? "border-[#b9d7eb] bg-[#e8f3fb]"
                                : "border-[var(--line)] bg-[var(--panel-muted)]"
                        }`}
                    >
                        <p className="font-semibold text-[var(--ink)]">{option.label}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{option.detail}</p>
                    </button>
                ))}
            </div>
        </Card>
    )
}

export default AssistancePanel
