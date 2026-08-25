import { Outlet } from "react-router-dom"
import { useState } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen overflow-x-hidden bg-[var(--shell)] px-3 py-3 text-[var(--ink)] sm:px-4 sm:py-4 lg:px-5">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1560px] gap-4">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <Topbar onMenuClick={() => setSidebarOpen(true)} />
                    <main className="flex-1 overflow-x-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf7_48%,#edf4fb_100%)] p-4 shadow-[0_18px_50px_rgba(28,46,74,0.07)] sm:rounded-[30px] sm:p-5 lg:rounded-[36px] lg:p-8">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}

export default Layout
