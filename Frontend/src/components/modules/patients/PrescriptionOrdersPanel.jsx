import Card from "../../common/Card"
import StatusPill from "../../common/StatusPill"

function PrescriptionOrdersPanel({ orders }) {
    return (
        <Card className="p-6">
            <h2 className="font-display text-3xl text-[var(--ink)]">Medicine Orders</h2>
            <div className="mt-5 space-y-4">
                {orders.map((order) => (
                    <div key={order.id} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold text-[var(--ink)]">{order.medicine}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{order.id} • {order.quantity} • {order.mode}</p>
                            </div>
                            <StatusPill tone={order.status === "Ready" ? "green" : "amber"}>{order.status}</StatusPill>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default PrescriptionOrdersPanel
