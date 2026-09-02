const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "")
const TOKEN_KEY = "careos-access-token"

// Subscribers are notified when the backend rejects our token so the app can
// return to the login screen instead of leaving the user on a broken page.
const unauthorizedHandlers = new Set()

export function onUnauthorized(handler) {
    unauthorizedHandlers.add(handler)
    return () => unauthorizedHandlers.delete(handler)
}

export function getAccessToken() {
    try {
        return window.localStorage.getItem(TOKEN_KEY)
    } catch {
        return null
    }
}

export function setAccessToken(token) {
    try {
        if (token) window.localStorage.setItem(TOKEN_KEY, token)
        else window.localStorage.removeItem(TOKEN_KEY)
    } catch {
        // Storage can be unavailable (private mode, blocked cookies). The session
        // still works for this page load; it just will not survive a reload.
    }
}

function messageFor(status, payload) {
    if (payload && typeof payload.detail === "string") return payload.detail
    if (Array.isArray(payload?.detail)) {
        return payload.detail
            .map((item) => `${item.loc?.slice(-1)[0] || "Field"}: ${item.msg || "invalid value"}`)
            .join(", ")
    }
    if (status === 401) return "Your session has expired. Please sign in again."
    if (status === 403) return "You do not have permission to do that."
    if (status === 404) return "That record could not be found."
    if (status === 429) return "Too many attempts. Please wait a moment and try again."
    if (status >= 500) return "Something went wrong on our side. Please try again."
    return "Request failed"
}

export async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {})
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    const token = getAccessToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)

    let response
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    } catch {
        const networkError = new Error("Cannot reach the CareOS server. Check your connection and try again.")
        networkError.status = 0
        throw networkError
    }

    const contentType = response.headers.get("content-type") || ""
    let payload = null
    if (response.status !== 204) {
        payload = contentType.includes("application/json")
            ? await response.json().catch(() => null)
            : await response.text().catch(() => null)
    }

    if (!response.ok) {
        // An expired or revoked token must end the session everywhere, not just
        // fail the one call that noticed. The login request itself is exempt:
        // a wrong password there is not a dead session.
        if (response.status === 401 && !path.startsWith("/auth/login")) {
            setAccessToken(null)
            unauthorizedHandlers.forEach((handler) => handler())
        }
        const error = new Error(messageFor(response.status, payload))
        error.status = response.status
        error.payload = payload
        throw error
    }
    return payload
}

export { API_BASE_URL }
