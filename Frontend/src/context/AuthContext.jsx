/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { changePassword as changePasswordRequest, getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/auth"
import { getAccessToken, onUnauthorized } from "../api/client"

const AuthContext = createContext(null)

const dashboardByRole = {
    doctor: "/doctor",
    pharmacy: "/pharmacy",
    patient: "/patient",
    receptionist: "/reception",
    admin: "/admin",
}

// Which routes each role may open. The backend remains authoritative; this
// stops a user from landing on a shell they can never populate.
const routesByRole = {
    admin: ["/admin", "/admin/patients", "/admin/patients/new", "/admin/patients/:id", "/pharmacy", "/appointments"],
    receptionist: ["/reception", "/admin/patients", "/admin/patients/new", "/admin/patients/:id", "/appointments", "/ai"],
    doctor: ["/doctor", "/records", "/appointments", "/ai"],
    patient: ["/patient", "/records", "/ai"],
    pharmacy: ["/pharmacy"],
}

export function dashboardPathFor(role) {
    return dashboardByRole[role] || "/login"
}

export function canAccessRoute(role, path) {
    const allowed = routesByRole[role]
    if (!allowed) return false
    return allowed.some((pattern) => {
        if (!pattern.includes(":")) return pattern === path
        const patternParts = pattern.split("/")
        const pathParts = path.split("/")
        if (patternParts.length !== pathParts.length) return false
        return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index])
    })
}

function withDashboard(user) {
    return { ...user, dashboardPath: dashboardPathFor(user.role) }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [mustChangePassword, setMustChangePassword] = useState(false)
    const [sessionExpired, setSessionExpired] = useState(false)

    useEffect(() => {
        // Skip the request entirely when no token is stored, rather than firing a
        // guaranteed 401 on every cold load.
        if (!getAccessToken()) {
            setLoading(false)
            return
        }
        let active = true
        getCurrentUser()
            .then((nextUser) => { if (active) setUser(withDashboard(nextUser)) })
            .catch(() => { if (active) setUser(null) })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    useEffect(() => onUnauthorized(() => {
        setUser(null)
        setMustChangePassword(false)
        setSessionExpired(true)
    }), [])

    const login = useCallback(async (loginId, password) => {
        const { user: nextUser, mustChangePassword: mustRotate } = await loginRequest(loginId, password)
        const enriched = withDashboard(nextUser)
        setUser(enriched)
        setMustChangePassword(Boolean(mustRotate))
        setSessionExpired(false)
        return enriched
    }, [])

    const logout = useCallback(() => {
        logoutRequest()
        setUser(null)
        setMustChangePassword(false)
        setSessionExpired(false)
    }, [])

    const changePassword = useCallback(async (currentPassword, newPassword) => {
        await changePasswordRequest(currentPassword, newPassword)
        setMustChangePassword(false)
    }, [])

    const value = useMemo(() => ({
        user,
        loading,
        mustChangePassword,
        sessionExpired,
        clearSessionExpired: () => setSessionExpired(false),
        login,
        logout,
        changePassword,
        canAccess: (path) => (user ? canAccessRoute(user.role, path) : false),
    }), [user, loading, mustChangePassword, sessionExpired, login, logout, changePassword])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider")
    }

    return context
}
