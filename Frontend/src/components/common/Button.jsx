function Button({ className = "", children, variant = "primary", ...props }) {
    const variants = {
        primary: "bg-[var(--primary-blue)] text-white",
        subtle: "bg-white/80 text-[var(--ink)] border border-[var(--line)]",
    }

    return (
        <button
            type="button"
            className={`inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2.5 text-center text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    )
}

export default Button
