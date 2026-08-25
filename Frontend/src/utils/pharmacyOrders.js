const STORAGE_KEY = "careos-pharmacy-orders"

export function loadQueuedPharmacyOrders() {
    if (typeof window === "undefined") {
        return []
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

export function saveQueuedPharmacyOrders(orders) {
    if (typeof window === "undefined") {
        return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function appendQueuedPharmacyOrder(order) {
    const current = loadQueuedPharmacyOrders()
    const next = [order, ...current]
    saveQueuedPharmacyOrders(next)
    return next
}
