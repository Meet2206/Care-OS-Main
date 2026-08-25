import { useState } from "react"
import { Navigate } from "react-router-dom"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import { useAuth } from "../../context/AuthContext"
import careOsLogo from "../../../logo-transparent.png"

function Login() {
    const { user, login } = useAuth()
    const [loginId, setLoginId] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    if (user) {
        return <Navigate to={user.dashboardPath} replace />
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")
        try {
            await login(loginId, password)
        } catch (requestError) {
            setError(requestError.message || "Unable to sign in.")
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#edf9f4_0%,#f6f1e8_42%,#ecf3fb_100%)] px-6 py-10">
            <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_20%_20%,rgba(173,220,238,0.55),transparent_38%),radial-gradient(circle_at_82%_16%,rgba(184,229,197,0.45),transparent_28%)]" />
            <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1240px] flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-[560px] space-y-8">
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-[var(--muted)] shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#2aa8b8]" />
                        Unified healthcare workspace
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">CareOS</p>
                            <h1 className="font-display text-5xl leading-[1.02] text-[var(--ink)] lg:text-6xl">
                                Access your hospital workspace.
                            </h1>
                        </div>

                        <p className="max-w-xl text-base leading-8 text-[var(--muted)]">
                            Designed for administrators,
                            clinicians and patients.
                            <br />
                            One platform for daily hospital operations.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        {[
                            ["Admin", "Operations overview"],
                            ["Doctor", "Daily clinical workflow"],
                            ["Patient", "Appointments and records"],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-[26px] border border-white/70 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-[2px]">
                                <p className="font-semibold text-[var(--ink)]">{label}</p>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="w-full max-w-[430px] p-6 sm:p-8">
                    <div className="mx-auto max-w-[320px]">
                        <div className="text-center">
                            <img
                                src={careOsLogo}
                                alt="CareOS"
                                className="mx-auto h-24 w-auto object-contain"
                            />
                            <p className="mt-3 text-sm text-[var(--muted)]"></p>
                        </div>

                        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Login ID</span>
                                <input
                                    value={loginId}
                                    onChange={(event) => setLoginId(event.target.value)}
                                    className="w-full rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                    placeholder="Your CARE-OS login ID"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Password</span>
                                <input
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    type="password"
                                    className="w-full rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                                    placeholder="Your password"
                                />
                            </label>

                            {error ? <p className="rounded-2xl bg-[#f9dfdb] px-4 py-3 text-sm text-[#8f4f44]">{error}</p> : null}

                            <Button type="submit" className="w-full py-3">Log In</Button>
                        </form>

                        <div className="mt-6 border-t border-[var(--line)] pt-5">
                            <p className="mt-4 text-xs leading-6 text-[var(--muted)]">Use the login ID provided by your CARE-OS administrator.</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default Login
