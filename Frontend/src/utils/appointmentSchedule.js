const WEEKDAY_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00",
]

const SATURDAY_SLOTS = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30"]

function localDate(value) {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
}

export function getAppointmentTimeSlots(dateValue) {
    const date = localDate(dateValue)
    if (!date || Number.isNaN(date.getTime()) || date.getDay() === 0) return []
    const times = date.getDay() === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS
    return times.map((time) => ({ time, status: "available" }))
}

export function getAppointmentScheduleError(dateValue, timeValue) {
    const date = localDate(dateValue)
    if (!date || Number.isNaN(date.getTime())) return "Choose a valid appointment date."
    if (date.getDay() === 0) return "Sundays are holidays. Choose another date."
    if (date.getDay() === 6 && (!timeValue || timeValue < "11:00" || timeValue >= "14:00")) {
        return "Saturday appointments are available only from 11:00 AM to 2:00 PM."
    }
    return ""
}

export function isSunday(date) {
    return date.getDay() === 0
}
