import Card from "./Card"

/**
 * One place for the loading / error / empty states so every module presents
 * them the same way instead of each page inventing its own.
 */
function AsyncState({ loading, error, empty, emptyTitle = "Nothing here yet", emptyHint, onRetry, children }) {
    if (loading) {
        return (
            <Card className="p-8">
                <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--primary-blue)]" />
                    Loading…
                </div>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="p-6">
                <p className="text-sm font-semibold text-[#9b5148]">{error}</p>
                {onRetry ? (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-4 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                    >
                        Try again
                    </button>
                ) : null}
            </Card>
        )
    }

    if (empty) {
        return (
            <Card className="p-8 text-center">
                <p className="font-display text-2xl text-[var(--ink)]">{emptyTitle}</p>
                {emptyHint ? <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{emptyHint}</p> : null}
            </Card>
        )
    }

    return children
}

export default AsyncState
