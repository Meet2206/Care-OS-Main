import { apiRequest, setAccessToken } from "./client"

export async function login(loginId, password) {
    const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login_id: loginId, password }),
    })
    setAccessToken(result.access_token)
    return result.user
}

export async function getCurrentUser() {
    return apiRequest("/auth/me")
}

export function logout() {
    setAccessToken(null)
}
