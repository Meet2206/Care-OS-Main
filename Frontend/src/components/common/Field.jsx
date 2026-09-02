const controlClass =
    "w-full rounded-[18px] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary-blue)]"

export function Field({ label, hint, error, required, children, className = "" }) {
    return (
        <label className={`block min-w-0 ${className}`}>
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                {label}
                {required ? <span className="ml-1 text-[#a34e43]">*</span> : null}
            </span>
            {children}
            {hint && !error ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
            {error ? <span className="mt-1 block text-xs font-semibold text-[#a34e43]">{error}</span> : null}
        </label>
    )
}

export function TextInput(props) {
    return <input {...props} className={`${controlClass} ${props.className || ""}`} />
}

export function Select({ children, ...props }) {
    return (
        <select {...props} className={`${controlClass} ${props.className || ""}`}>
            {children}
        </select>
    )
}

export function TextArea(props) {
    return <textarea {...props} className={`${controlClass} min-h-24 ${props.className || ""}`} />
}

export default Field
