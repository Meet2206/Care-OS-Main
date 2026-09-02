import { apiRequest, setAccessToken } from "./client"

export async function login(loginId, password) {
    const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login_id: loginId, password }),
    })
    setAccessToken(result.access_token)
    return { user: result.user, mustChangePassword: result.must_change_password }
}

export async function getCurrentUser() {
    return apiRequest("/auth/me")
}

export async function changePassword(currentPassword, newPassword) {
    return apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
}

export function logout() {
    setAccessToken(null)
}
