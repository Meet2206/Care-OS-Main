import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import RoleRedirect from "./components/RoleRedirect"
import Layout from "./components/layout/Layout"
import ChangePasswordGate from "./components/ChangePasswordGate"
import { useAuth } from "./context/AuthContext"
import Login from "./pages/auth/Login"
import CareAI from "./pages/ai/CareAI"
import AdminDashboard from "./pages/dashboard/AdminDashboard"
import ReceptionDashboard from "./pages/dashboard/ReceptionDashboard"
import DoctorDashboard from "./pages/dashboard/DoctorDashboard"
import PharmacyDashboard from "./pages/dashboard/PharmacyDashboard"
import PatientDashboard from "./pages/dashboard/PatientDashboard"
import MedicalRecords from "./pages/records/MedicalRecords"
import Appointments from "./pages/appointments/Appointments"
import PatientList from "./pages/patients/PatientList"
import PatientOnboarding from "./pages/patients/PatientOnboarding"
import PatientDetails from "./pages/patients/PatientDetails"

function AppRoutes() {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
                Loading CareOS…
            </div>
        )
    }

    return (
        <BrowserRouter>
            {/* A system-generated password must be rotated before the app is usable. */}
            <ChangePasswordGate />
            <Routes>
                <Route path="/" element={<Navigate to={user ? user.dashboardPath : "/login"} replace />} />
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        <Route path="/app" element={<RoleRedirect />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="/reception" element={<ReceptionDashboard />} />
                        <Route path="/admin/patients" element={<PatientList />} />
                        <Route path="/admin/patients/new" element={<PatientOnboarding />} />
                        <Route path="/admin/patients/:id" element={<PatientDetails />} />
                        <Route path="/doctor" element={<DoctorDashboard />} />
                        <Route path="/patient" element={<PatientDashboard />} />
                        <Route path="/pharmacy" element={<PharmacyDashboard />} />
                        <Route path="/appointments" element={<Appointments />} />
                        <Route path="/records" element={<MedicalRecords />} />
                        <Route path="/ai" element={<CareAI />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRoutes
