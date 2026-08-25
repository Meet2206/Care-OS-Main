import Card from "../../common/Card"
import Button from "../../common/Button"
import StatusPill from "../../common/StatusPill"

function PharmacyQueuePanel({ orders, onAccept, onPack, onDispense, onView, className }) {
    return (
        <Card className={`p-6 ${className || ""}`}>
            <h2 className="shrink-0 font-display text-3xl text-[var(--ink)]">Order Queue</h2>
            <div className="responsive-table scroll-table relative mt-5 min-h-0 flex-1 rounded-[24px] border border-[var(--line)]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--panel-muted)] text-[var(--muted)] shadow-[0_1px_0_var(--line)]">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Token</th>
                            <th className="px-4 py-3 font-semibold">Patient</th>
                            <th className="px-4 py-3 font-semibold">Details</th>
                            <th className="px-4 py-3 font-semibold">Mode</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.token} className="border-t border-[var(--line)] text-[var(--ink)]">
                                <td data-label="Token" className="px-4 py-4">{order.token}</td>
                                <td data-label="Patient" className="px-4 py-4">
                                    <p>{order.patient}</p>
                                    <p className="text-xs text-[var(--muted)]">{order.patientId}</p>
                                </td>
                                <td data-label="Details" className="px-4 py-4 text-xs text-[var(--muted)]">
                                    <p>{order.items} item{order.items === 1 ? "" : "s"}</p>
                                    {order.doctor ? <p className="mt-1">From {order.doctor}</p> : null}
                                </td>
                                <td data-label="Mode" className="px-4 py-4 text-[var(--muted)]">{order.mode}</td>
                                <td data-label="Status" className="px-4 py-4">
                                    <StatusPill tone={order.status === "DISPENSED" ? "green" : order.status === "PACKED" ? "blue" : "amber"}>
                                        {order.status}
                                    </StatusPill>
                                </td>
                                <td data-label="Action" className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="subtle" className="px-4 py-2" onClick={() => onView(order)}>
                                            View
                                        </Button>
                                        {order.status === "PENDING" ? (
                                            <Button variant="subtle" className="px-4 py-2" onClick={() => onAccept(order.token)}>
                                                Accept
                                            </Button>
                                        ) : order.status === "ACCEPTED" ? (
                                            <Button variant="subtle" className="px-4 py-2" onClick={() => onPack(order.token)}>
                                                Mark Packed
                                            </Button>
                                        ) : order.status === "DISPENSED" ? (
                                            <Button variant="subtle" className="px-4 py-2" disabled>
                                                Dispensed
                                            </Button>
                                        ) : (
                                            <Button variant="subtle" className="px-4 py-2" onClick={() => onDispense(order.token)}>
                                                Mark Dispensed
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}

export default PharmacyQueuePanel
