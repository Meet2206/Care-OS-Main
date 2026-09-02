import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function ProtectedRoute() {
    const { user, loading, canAccess } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
                Loading your workspace…
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }

    // A signed-in user reaching a portal that is not theirs goes to their own
    // dashboard. The backend enforces the same boundary on every request.
    if (!canAccess(location.pathname)) {
        return <Navigate to={user.dashboardPath} replace />
    }

    return <Outlet />
}

export default ProtectedRoute
