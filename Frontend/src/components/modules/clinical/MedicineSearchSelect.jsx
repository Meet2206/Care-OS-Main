import { useEffect, useRef, useState } from "react"
import { apiRequest } from "../../../api/client"

/**
 * Type-ahead over the full medicine catalogue.
 *
 * The prescription form previously offered a fixed page of the first 50 rows of
 * an 11,825-entry catalogue, so most medicines could not be prescribed at all.
 * This queries the backend search endpoint as the clinician types.
 */
function MedicineSearchSelect({ value, onSelect, placeholder = "Search medicines…" }) {
    const [query, setQuery] = useState(value || "")
    const [options, setOptions] = useState([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const containerRef = useRef(null)

    useEffect(() => { setQuery(value || "") }, [value])

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        if (!open) return undefined
        const term = query.trim()
        let active = true
        // Debounced so a keystroke does not become a request.
        const timer = setTimeout(async () => {
            setLoading(true)
            setError("")
            try {
                const result = await apiRequest(
                    `/medicines/search?limit=20${term ? `&q=${encodeURIComponent(term)}` : ""}`,
                )
                if (active) setOptions(result.data || [])
            } catch (requestError) {
                if (active) setError(requestError.message || "Unable to search medicines.")
            } finally {
                if (active) setLoading(false)
            }
        }, 250)
        return () => { active = false; clearTimeout(timer) }
    }, [query, open])

    const choose = (option) => {
        onSelect(option)
        setQuery(option.medicine_name)
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative">
            <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full rounded-[16px] border border-[rgba(181,198,214,0.92)] bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(236,244,249,0.94))] px-4 py-3 text-sm font-medium text-[var(--ink)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            />
            {open ? (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-[16px] border border-[var(--line)] bg-white shadow-[0_16px_40px_rgba(28,46,74,0.16)]">
                    {loading ? (
                        <p className="px-4 py-3 text-sm text-[var(--muted)]">Searching…</p>
                    ) : error ? (
                        <p className="px-4 py-3 text-sm text-[#9b5148]">{error}</p>
                    ) : options.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-[var(--muted)]">No medicines match that search.</p>
                    ) : (
                        options.map((option) => (
                            <button
                                key={option.medicine_id}
                                type="button"
                                onClick={() => choose(option)}
                                className="block w-full px-4 py-2.5 text-left hover:bg-[var(--panel-muted)]"
                            >
                                <span className="block text-sm font-semibold text-[var(--ink)]">{option.medicine_name}</span>
                                {option.composition ? (
                                    <span className="text-wrap-anywhere block text-xs text-[var(--muted)]">{option.composition}</span>
                                ) : null}
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    )
}

export default MedicineSearchSelect
