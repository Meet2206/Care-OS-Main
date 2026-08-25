function PageIntro({ eyebrow, title, description, actions, className }) {
    return (
        <div className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className || ""}`}>
            <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{eyebrow}</p>
                <h1 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">{title}</h1>
                <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>
            </div>
            {actions ? <div className="flex w-full flex-wrap gap-3 sm:w-auto">{actions}</div> : null}
        </div>
    )
}

export default PageIntro
