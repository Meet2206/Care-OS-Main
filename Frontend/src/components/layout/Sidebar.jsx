import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import careOsLogo from "../../../logo-transparent.png"

const icons = {
    Dashboard: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
            <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
            <rect x="3.5" y="12.5" width="7" height="8" rx="1.5" />
        </svg>
    ),
    CareAI: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v4" />
            <path d="M7 5.5 9.5 8" />
            <path d="M17 5.5 14.5 8" />
            <path d="M7 13a5 5 0 1 1 10 0v3.5A2.5 2.5 0 0 1 14.5 19h-5A2.5 2.5 0 0 1 7 16.5Z" />
            <path d="M9.5 13h.01" />
            <path d="M14.5 13h.01" />
            <path d="M9 18.8V21" />
            <path d="M15 18.8V21" />
        </svg>
    ),
    "Medical Records": (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
            <path d="M14 3.5v4h4" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
        </svg>
    ),
    Pharmacy: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M8 4.5h8" />
            <path d="M9 4.5v4l-3.5 5.5A4 4 0 0 0 8.9 20h6.2a4 4 0 0 0 3.4-6l-3.5-5.5v-4" />
            <path d="M9 12h6" />
        </svg>
    ),
    Appointments: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 9.5h17" />
            <path d="M8 3.5v3" />
            <path d="M16 3.5v3" />
            <path d="M8.5 13.5h3" />
        </svg>
    ),
    Patients: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
}

function Sidebar({ open = false, onClose }) {
    const { user } = useAuth()

    const itemsByRole = {
        admin: [
            { label: "Dashboard", to: "/admin" },
            { label: "Patients", to: "/admin/patients" },
            { label: "Appointments", to: "/appointments" },
            { label: "Pharmacy", to: "/pharmacy" },
        ],
        receptionist: [
            { label: "Dashboard", to: "/reception" },
            { label: "Patients", to: "/admin/patients" },
            { label: "Appointments", to: "/appointments" },
            { label: "CareAI", to: "/ai" },
        ],
        doctor: [
            { label: "Dashboard", to: "/doctor" },
            { label: "Appointments", to: "/appointments" },
            { label: "Medical Records", to: "/records" },
            { label: "CareAI", to: "/ai" },
        ],
        patient: [
            { label: "Dashboard", to: "/patient" },
            { label: "Medical Records", to: "/records" },
            { label: "CareAI", to: "/ai" },
        ],
        // Pharmacy handles dispensing only; clinical records are out of scope.
        pharmacy: [
            { label: "Dashboard", to: "/pharmacy" },
        ],
    }

    const items = itemsByRole[user?.role] ?? [{ label: "Dashboard", to: user?.dashboardPath ?? "/login" }]

    return (
        <>
            {open ? (
                <button
                    type="button"
                    aria-label="Close navigation overlay"
                    className="fixed inset-0 z-30 bg-[rgba(15,23,42,0.28)] lg:hidden"
                    onClick={onClose}
                />
            ) : null}
            <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] max-w-[86vw] overflow-y-auto rounded-r-[30px] border-r border-white/70 bg-[linear-gradient(180deg,#effaf5_0%,#eaf4fb_100%)] px-5 py-6 shadow-[0_20px_60px_rgba(23,41,63,0.18)] transition-transform duration-200 lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:w-[272px] lg:translate-x-0 lg:rounded-r-[36px] lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex items-start justify-between gap-3">
            <NavLink
                to={user?.dashboardPath ?? "/login"}
                className="flex items-center gap-3 rounded-[28px] px-3 py-2 transition-colors hover:bg-white/50"
                onClick={onClose}
            >
                <img
                    src={careOsLogo}
                    alt="CareOS"
                    className="h-24 w-auto rounded-[20px] object-contain"
                />
            </NavLink>
                <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-sm font-semibold text-[var(--muted)] lg:hidden"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>

            <nav className="mt-10 space-y-2">
                {items.map((item) => (
                    <NavLink
                        key={item.label}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
                                isActive
                                    ? "bg-white text-[var(--ink)] shadow-sm"
                                    : "text-[var(--muted)] hover:bg-white/65 hover:text-[var(--ink)]"
                            }`
                        }
                    >
                        {icons[item.label]}
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="mt-10 rounded-[28px] border border-white/70 bg-white/65 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Goal</p>
                <p className="mt-2 font-display text-2xl text-[var(--ink)]">
                    {user?.role === "admin"
                        ? "Operational Oversight"
                        : user?.role === "receptionist"
                            ? "Patient Coordination"
                        : user?.role === "doctor"
                            ? "Actionable Lists"
                            : user?.role === "pharmacy"
                                ? "Fast Dispensing"
                                : "Transparency & Accessibility"}
                </p>
            </div>
        </aside>
        </>
    )
}

export default Sidebar
