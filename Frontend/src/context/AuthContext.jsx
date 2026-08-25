/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/auth"

const AuthContext = createContext(null)
const dashboardByRole = {
    doctor: "/doctor",
    pharmacy: "/pharmacy",
    patient: "/patient",
    receptionist: "/admin",
    admin: "/admin",
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCurrentUser()
            .then((nextUser) => setUser({ ...nextUser, dashboardPath: dashboardByRole[nextUser.role] || "/login" }))
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [])

    const value = useMemo(() => ({
        user,
        loading,
        login: async (loginId, password) => {
            const nextUser = await loginRequest(loginId, password)
            const enrichedUser = { ...nextUser, dashboardPath: dashboardByRole[nextUser.role] || "/login" }
            setUser(enrichedUser)
            return enrichedUser
        },
        logout: () => {
            logoutRequest()
            setUser(null)
        },
    }), [loading, user])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider")
    }

    return context
}
