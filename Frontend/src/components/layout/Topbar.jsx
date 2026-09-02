import { useState, useRef, useEffect, useCallback } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { apiRequest } from "../../api/client"

const titles = {
    "/admin": "Admin Dashboard",
    "/reception": "Reception Desk",
    "/doctor": "Doctor Dashboard",
    "/patient": "Patient Dashboard",
    "/pharmacy": "Pharmacy Dashboard",
    "/records": "Medical Records",
    "/appointments": "Appointments",
    "/ai": "CareAI",
    "/admin/patients": "Patient Registry",
    "/admin/patients/new": "Register Patient",
}

const eyebrowByRole = {
    admin: "Administration",
    receptionist: "Front Desk",
    doctor: "Clinical Workspace",
    patient: "Patient Portal",
    pharmacy: "Pharmacy",
}

function titleFor(pathname) {
    if (titles[pathname]) return titles[pathname]
    if (pathname.startsWith("/admin/patients/")) return "Patient Details"
    return "CareOS"
}

function Topbar({ onMenuClick }) {
    const location = useLocation()
    const { user, logout } = useAuth()
    const [showAlerts, setShowAlerts] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [loadingAlerts, setLoadingAlerts] = useState(false)
    const [alertsError, setAlertsError] = useState("")
    const panelRef = useRef(null)
    const buttonRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                panelRef.current && !panelRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)
            ) {
                setShowAlerts(false)
            }
        }
        if (showAlerts) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showAlerts])

    // Notifications come from the backend rather than a fixed list, so the badge
    // reflects something real and disappears when there is nothing to show.
    const loadNotifications = useCallback(async () => {
        setLoadingAlerts(true)
        setAlertsError("")
        try {
            const result = await apiRequest("/notifications?limit=10")
            setNotifications(result.data || [])
        } catch (error) {
            setAlertsError(error.message || "Unable to load notifications.")
        } finally {
            setLoadingAlerts(false)
        }
    }, [])

    useEffect(() => { if (user) loadNotifications() }, [user, loadNotifications])

    const unread = notifications.filter((item) => item.status !== "Read").length

    return (
        <header className="relative flex min-h-[76px] flex-col gap-4 rounded-[24px] border border-white/70 bg-white/88 px-4 py-4 shadow-[0_12px_30px_rgba(28,46,74,0.06)] sm:rounded-[30px] sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-muted)] text-[var(--muted)] lg:hidden"
                    aria-label="Open navigation"
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h16" />
                    </svg>
                </button>
                <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                        {eyebrowByRole[user?.role] || "CareOS"}
                    </p>
                    <h1 className="mt-2 truncate font-display text-[26px] leading-none text-[var(--ink)] sm:text-[30px]">
                        {titleFor(location.pathname)}
                    </h1>
                </div>
            </div>

            <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => { setShowAlerts((current) => !current); if (!showAlerts) loadNotifications() }}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-muted)] text-[var(--muted)]"
                    aria-label={unread ? `${unread} unread notifications` : "Notifications"}
                >
                    {unread > 0 ? (
                        <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f46d61] px-1 text-[10px] font-bold text-white">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    ) : null}
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
                        <path d="M10.2 19a2 2 0 0 0 3.6 0" />
                    </svg>
                </button>

                {showAlerts ? (
                    <div
                        ref={panelRef}
                        className="absolute right-4 top-[84px] z-30 max-h-80 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(28,46,74,0.14)]"
                    >
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Notifications</p>
                        {loadingAlerts ? (
                            <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
                        ) : alertsError ? (
                            <p className="mt-3 text-sm text-[#9b5148]">{alertsError}</p>
                        ) : notifications.length === 0 ? (
                            <p className="mt-3 text-sm text-[var(--muted)]">You are all caught up.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {notifications.map((item) => (
                                    <li key={item.notification_id} className="rounded-2xl bg-[var(--panel-muted)] px-3 py-2">
                                        <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                                        <p className="text-wrap-anywhere mt-1 text-xs leading-5 text-[var(--muted)]">{item.message}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}

                <div className="flex min-w-0 items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] py-1 pl-1 pr-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#cfe6f7,#dff0e4)] text-sm font-semibold text-[var(--ink)]">
                        {(user?.full_name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{user?.full_name}</span>
                        <span className="block truncate text-xs capitalize text-[var(--muted)]">{user?.role}</span>
                    </span>
                </div>

                <button
                    type="button"
                    onClick={logout}
                    className="shrink-0 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                >
                    Logout
                </button>
            </div>
        </header>
    )
}

export default Topbar
