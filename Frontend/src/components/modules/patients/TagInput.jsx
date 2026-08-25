import { useState, useRef, useEffect } from "react"

function TagInput({ value = [], onChange, suggestions = [], placeholder = "Type and press Enter…", label, id }) {
    const [input, setInput] = useState("")
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const inputRef = useRef(null)
    const containerRef = useRef(null)

    const filteredSuggestions = suggestions.filter(
        (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s),
    )

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const addTag = (tag) => {
        const trimmed = tag.trim()
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed])
        }
        setInput("")
        setHighlightIndex(-1)
        inputRef.current?.focus()
    }

    const removeTag = (tag) => {
        onChange(value.filter((t) => t !== tag))
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault()
            if (highlightIndex >= 0 && highlightIndex < filteredSuggestions.length) {
                addTag(filteredSuggestions[highlightIndex])
            } else if (input.trim()) {
                addTag(input)
            }
        } else if (e.key === "Backspace" && !input && value.length > 0) {
            removeTag(value[value.length - 1])
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightIndex((prev) => Math.max(prev - 1, 0))
        } else if (e.key === "Escape") {
            setShowSuggestions(false)
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {label && (
                <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                    {label}
                </label>
            )}
            <div
                className="flex min-h-[44px] flex-wrap gap-2 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 transition-all focus-within:border-[var(--primary-blue)] focus-within:ring-2 focus-within:ring-[var(--primary-blue)]/20"
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="anim-scale-in inline-flex items-center gap-1.5 rounded-full bg-[#e8f0fb] px-3 py-1 text-xs font-semibold text-[#2a5fa5]"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[#2a5fa5]/60 transition-colors hover:bg-[#2a5fa5]/15 hover:text-[#2a5fa5]"
                            aria-label={`Remove ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); setHighlightIndex(-1) }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder : ""}
                    className="min-w-[100px] flex-1 bg-transparent py-0.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]/50"
                    autoComplete="off"
                    aria-label={label || placeholder}
                />
            </div>

            {/* Suggestion dropdown */}
            {showSuggestions && input && filteredSuggestions.length > 0 && (
                <div className="anim-fade-in-up absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/95 py-1 shadow-lg backdrop-blur-sm">
                    {filteredSuggestions.slice(0, 8).map((suggestion, index) => (
                        <button
                            key={suggestion}
                            type="button"
                            className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors ${
                                index === highlightIndex
                                    ? "bg-[#e8f0fb] text-[var(--ink)]"
                                    : "text-[var(--muted)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)]"
                            }`}
                            onMouseDown={(e) => { e.preventDefault(); addTag(suggestion) }}
                        >
                            <span className="mr-2 text-xs text-[var(--primary-blue)]">+</span>
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default TagInput
