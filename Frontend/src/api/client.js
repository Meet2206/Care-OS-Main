const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "")
const TOKEN_KEY = "careos-access-token"

export function getAccessToken() {
    return window.localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token) {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
}

export async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {})
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    const token = getAccessToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    const contentType = response.headers.get("content-type") || ""
    const payload = contentType.includes("application/json") ? await response.json() : await response.text()
    if (!response.ok) {
        const error = new Error(payload?.detail || "Request failed")
        error.status = response.status
        error.payload = payload
        throw error
    }
    return payload
}

export { API_BASE_URL }
