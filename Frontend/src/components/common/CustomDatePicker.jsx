import { useState, useRef, useEffect } from "react"

function buildCalendarDays(visibleMonth) {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = (firstDay.getDay() + 6) % 7
    const days = []

    for (let index = 0; index < startPadding; index += 1) {
        days.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
        days.push(new Date(year, month, day))
    }

    return days
}

function isSameDate(a, b) {
    if (!a || !b) return false
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

function toDateString(date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}

function formatDateDisplay(value) {
    if (!value) return ""
    const [year, month, day] = value.split("-")
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
}

function CustomDatePicker({ value, onChange, max, placeholder = "Select date", id, suffix }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    const today = new Date()
    const selectedDate = value ? new Date(`${value}T00:00:00`) : null
    const initialMonth = selectedDate ?? today
    const [visibleMonth, setVisibleMonth] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1))

    const days = buildCalendarDays(visibleMonth)
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const maxDateFloor = max ? new Date(`${max}T00:00:00`) : null

    // Update visible month when selected date changes externally
    useEffect(() => {
        if (value) {
            const nextSelectedDate = new Date(`${value}T00:00:00`)
            setVisibleMonth(new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1))
        }
    }, [value])

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    const changeMonth = (offset) => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    }

    const handleMonthChange = (e) => {
        const newMonth = parseInt(e.target.value)
        setVisibleMonth(new Date(visibleMonth.getFullYear(), newMonth, 1))
    }

    const handleYearChange = (e) => {
        const newYear = parseInt(e.target.value)
        setVisibleMonth(new Date(newYear, visibleMonth.getMonth(), 1))
    }

    const selectDate = (date) => {
        onChange(toDateString(date))
        setIsOpen(false)
    }

    const currentYear = today.getFullYear()
    const years = Array.from({ length: 101 }, (_, i) => currentYear - i) // 100 years back
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* Input Trigger Field */}
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    readOnly
                    onClick={() => setIsOpen(!isOpen)}
                    value={formatDateDisplay(value)}
                    placeholder={placeholder}
                    className={`form-input cursor-pointer pl-14 font-medium select-none ${suffix ? "pr-20" : ""}`}
                />
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className="cursor-pointer absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary-blue)]/10"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--primary-blue)]" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                        <rect x="8" y="14" width="2" height="2" rx="0.5" />
                        <rect x="14" y="14" width="2" height="2" rx="0.5" />
                        <rect x="8" y="18" width="2" height="2" rx="0.5" />
                    </svg>
                </div>
                {suffix && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                        {suffix}
                    </div>
                )}
            </div>

            {/* Custom Popover Calendar */}
            {isOpen && (
                <div className="absolute left-0 mt-2 w-[310px] sm:w-[330px] rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Header Month / Year drop box and prev/next chevrons */}
                    <div className="flex items-center justify-between px-1">
                        <button
                            type="button"
                            onClick={() => changeMonth(-1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)] active:scale-95 transition-all"
                            aria-label="Previous month"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        
                        {/* Month & Year Select Dropdowns */}
                        <div className="flex items-center gap-1.5 bg-[var(--panel-muted)] px-3 py-1 rounded-xl border border-[var(--line)]/50">
                            <select
                                value={visibleMonth.getMonth()}
                                onChange={handleMonthChange}
                                className="bg-transparent text-sm font-bold text-[var(--ink)] cursor-pointer outline-none hover:text-[var(--primary-blue)] transition-colors pr-1"
                            >
                                {months.map((m, idx) => (
                                    <option key={idx} value={idx}>{m}</option>
                                ))}
                            </select>
                            
                            <span className="text-[var(--muted)] text-xs font-semibold">/</span>
                            
                            <select
                                value={visibleMonth.getFullYear()}
                                onChange={handleYearChange}
                                className="bg-transparent text-sm font-bold text-[var(--ink)] cursor-pointer outline-none hover:text-[var(--primary-blue)] transition-colors"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => changeMonth(1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)] active:scale-95 transition-all"
                            aria-label="Next month"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {weekDays.map((day) => (
                            <div key={day} className="py-1">{day}</div>
                        ))}
                    </div>
                    
                    {/* Divider */}
                    <div className="my-1.5 border-b border-[var(--line)]/40" />

                    {/* Days Grid */}
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                        {days.map((day, index) => {
                            if (!day) {
                                return <div key={`empty-${index}`} className="aspect-square w-full" />
                            }

                            const dayFloor = new Date(day.getFullYear(), day.getMonth(), day.getDate())
                            const isDisabledByMax = maxDateFloor && dayFloor > maxDateFloor
                            const disabled = isDisabledByMax
                            
                            const selected = isSameDate(day, selectedDate)
                            const isToday = !selectedDate && isSameDate(day, todayFloor)

                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => selectDate(day)}
                                    className={`aspect-square w-full rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center ${
                                        disabled
                                            ? "cursor-not-allowed opacity-[0.2] text-[var(--muted)] pointer-events-none"
                                            : selected
                                                ? "bg-[var(--primary-blue)] text-white shadow-[0_4px_10px_rgba(63,120,200,0.25)] scale-[1.05]"
                                                : isToday
                                                    ? "bg-emerald-50 border border-emerald-400/60 text-emerald-700 shadow-sm"
                                                    : "bg-white border border-[var(--line)]/50 text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:bg-[var(--primary-blue)]/5 hover:text-[var(--primary-blue)] hover:border-[var(--primary-blue)]/30 hover:scale-[1.05] active:scale-95"
                                    }`}
                                >
                                    {day.getDate()}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default CustomDatePicker
