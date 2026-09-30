import Button from "../../common/Button"
import Card from "../../common/Card"
import StatusPill from "../../common/StatusPill"

function PrescriptionOrdersPanel({ orders, onFulfillment, onPayment }) {
    return (
        <Card className="p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Persisted prescription fulfillment</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">Medicine Orders</h2>
            <div className="mt-5 space-y-4">
                {!orders.length ? <p className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4 text-sm text-[var(--muted)]">No prescriptions are ready for pharmacy fulfillment.</p> : null}
                {orders.map((order) => (
                    <div key={order.order_id} className="rounded-2xl bg-[var(--panel-muted)] px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="font-semibold text-[var(--ink)]">{order.order_id} · {order.prescription_id}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">Doctor {order.doctor_id} • {order.payment_status || "Pending"}</p>
                            </div>
                            <StatusPill tone={order.status === "COLLECTED" ? "green" : order.status === "READY_FOR_PICKUP" ? "blue" : "amber"}>{order.status}</StatusPill>
                        </div>
                        <div className="mt-3 space-y-2">
                            {order.medicines.map((medicine) => (
                                <div key={medicine.medicine_id} className="rounded-xl bg-white px-3 py-3 text-sm">
                                    <p className="font-semibold text-[var(--ink)]">{medicine.medicine_name}</p>
                                    <p className="mt-1 text-[var(--muted)]">Prescribed: {medicine.prescribed_quantity} • Fulfillment: {medicine.fulfillment_quantity || "—"}</p>
                                    <p className="mt-1 text-[var(--muted)]">Frequency: {Array.isArray(medicine.frequency) ? medicine.frequency.join(", ") : medicine.frequency}{medicine.number_of_doses ? ` • ${medicine.number_of_doses} doses` : ""}{medicine.dosage || medicine.duration ? ` • ${[medicine.dosage, medicine.duration].filter(Boolean).join(" • ")}` : ""}</p>
                                    {medicine.instructions ? <p className="mt-1 text-[var(--muted)]">{medicine.instructions}</p> : null}
                                </div>
                            ))}
                        </div>
                        {order.status === "PENDING" || order.status === "PENDING_PAYMENT" ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button variant="subtle" className="px-4 py-2" onClick={() => onFulfillment(order, "FULL")}>Full prescribed quantity</Button>
                                <Button variant="subtle" className="px-4 py-2" onClick={() => onFulfillment(order, "HALF")}>Half prescribed quantity</Button>
                            </div>
                        ) : null}
                        {order.status === "PENDING_PAYMENT" ? <Button className="mt-3 px-4 py-2" onClick={() => onPayment(order)}>Proceed to payment</Button> : null}
                        {order.status === "READY_FOR_PICKUP" ? <p className="mt-3 text-sm font-semibold text-[#3e6b50]">Paid and ready for pharmacy pickup. Show the pickup token at the counter.</p> : null}
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default PrescriptionOrdersPanel
