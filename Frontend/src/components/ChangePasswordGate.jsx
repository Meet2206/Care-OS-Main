import { useState } from "react"
import Button from "./common/Button"
import Modal from "./common/Modal"
import Field, { TextInput } from "./common/Field"
import { useAuth } from "../context/AuthContext"

/**
 * Blocks the application until a system-generated password has been rotated.
 *
 * Patient accounts are created with a random temporary password handed over at
 * the registration desk. Forcing the change here means that password stops
 * being a working credential the moment the patient signs in.
 */
function ChangePasswordGate() {
    const { mustChangePassword, changePassword, logout } = useAuth()
    const [current, setCurrent] = useState("")
    const [next, setNext] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    if (!mustChangePassword) return null

    const submit = async (event) => {
        event.preventDefault()
        setError("")
        if (next !== confirm) {
            setError("The two new passwords do not match.")
            return
        }
        setSaving(true)
        try {
            await changePassword(current, next)
            setCurrent(""); setNext(""); setConfirm("")
        } catch (requestError) {
            setError(requestError.message || "Unable to change the password.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open onClose={logout} title="Choose your own password" eyebrow="First sign-in" maxWidthClass="max-w-md">
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm leading-7 text-[var(--muted)]">
                    Your account was created with a temporary password. Set your own before continuing.
                </p>
                <Field label="Temporary password" required>
                    <TextInput type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
                </Field>
                <Field label="New password" required hint="At least 8 characters, mixing letters and numbers.">
                    <TextInput type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
                </Field>
                <Field label="Confirm new password" required>
                    <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                </Field>
                {error ? <p className="rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9b5148]">{error}</p> : null}
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="subtle" onClick={logout}>Sign out</Button>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Set password"}</Button>
                </div>
            </form>
        </Modal>
    )
}

export default ChangePasswordGate
