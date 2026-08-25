import { useState } from "react"

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
    if (!a || !b) {
        return false
    }

    return (
        a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate()
    )
}

function toDateString(date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}

function BookingCalendar({ value, onChange }) {
    const today = new Date()
    const selectedDate = value ? new Date(`${value}T00:00:00`) : null
    const initialMonth = selectedDate ?? today
    const [visibleMonth, setVisibleMonth] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1))
    const monthLabel = visibleMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    const days = buildCalendarDays(visibleMonth)
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const changeMonth = (offset) => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    }

    return (
        <div className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-5">
            {/* Header: Month and Navigation */}
            <div className="flex items-center justify-between px-1">
                <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)] hover:border-[var(--muted)]/30 active:scale-95 transition-all"
                    aria-label="Previous month"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <p className="text-sm font-bold text-[var(--ink)] sm:text-base tracking-tight">{monthLabel}</p>
                <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)] hover:border-[var(--muted)]/30 active:scale-95 transition-all"
                    aria-label="Next month"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* Weekdays Header */}
            <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] sm:gap-2 sm:text-xs">
                {weekDays.map((day) => (
                    <div key={day} className="py-1">{day}</div>
                ))}
            </div>
            
            {/* Divider */}
            <div className="my-1.5 border-b border-[var(--line)]/40" />

            {/* Calendar Days Grid */}
            <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                {days.map((day, index) => {
                    if (!day) {
                        return <div key={`empty-${index}`} className="aspect-square w-full" />
                    }

                    const dayFloor = new Date(day.getFullYear(), day.getMonth(), day.getDate())
                    const disabled = dayFloor < todayFloor
                    const selected = isSameDate(day, selectedDate)
                    const isToday = !selectedDate && isSameDate(day, todayFloor)

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(toDateString(day))}
                            className={`aspect-square w-full rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center ${
                                disabled
                                    ? "cursor-not-allowed opacity-[0.2] text-[var(--muted)] pointer-events-none"
                                    : selected
                                        ? "bg-[var(--primary-blue)] text-white shadow-[0_4px_12px_rgba(63,120,200,0.25)] scale-[1.05] ring-2 ring-[var(--primary-blue)]/20"
                                        : isToday
                                            ? "bg-emerald-50 border border-emerald-400/60 text-emerald-700 shadow-sm"
                                            : "bg-white border border-[var(--line)]/50 text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.015)] hover:bg-[var(--primary-blue)]/5 hover:text-[var(--primary-blue)] hover:border-[var(--primary-blue)]/30 hover:scale-[1.05] active:scale-95"
                            }`}
                        >
                            {day.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default BookingCalendar
