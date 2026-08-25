import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function ProtectedRoute() {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return null
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }

    return <Outlet />
}

export default ProtectedRoute
