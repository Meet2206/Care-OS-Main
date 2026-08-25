import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function RoleRedirect() {
    const { user } = useAuth()

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <Navigate to={user.dashboardPath} replace />
}

export default RoleRedirect
