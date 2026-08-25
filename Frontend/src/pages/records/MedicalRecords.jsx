import { useState } from "react"
import { jsPDF } from "jspdf"
import Button from "../../components/common/Button"
import Card from "../../components/common/Card"
import Modal from "../../components/common/Modal"
import PageIntro from "../../components/common/PageIntro"
import { medicalRecords } from "../../data/mockData"

function MedicalRecords() {
    const [selectedRecord, setSelectedRecord] = useState(null)
    const [filter, setFilter] = useState("all")

    const visibleRecords = medicalRecords.filter((record) => {
        if (filter === "all") {
            return true
        }

        return record.type.toLowerCase().includes(filter)
    })

    const handleFilter = () => {
        setFilter((current) => {
            if (current === "all") return "consultation"
            if (current === "consultation") return "lab"
            if (current === "lab") return "imaging"
            return "all"
        })
    }

    const filterLabel =
        filter === "all"
            ? "All Records"
            : filter === "consultation"
                ? "Consultation Only"
                : filter === "lab"
                    ? "Lab Results"
                    : "Imaging Only"

    const downloadRecord = (record) => {
        const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })

        pdf.setFillColor(246, 241, 232)
        pdf.rect(0, 0, 595, 842, "F")
        pdf.setFillColor(255, 250, 244)
        pdf.setDrawColor(216, 206, 193)
        pdf.roundedRect(36, 36, 523, 360, 18, 18, "FD")
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(10)
        pdf.setTextColor(110, 116, 111)
        pdf.text("CAREOS MEDICAL RECORD", 60, 68)
        pdf.setFont("times", "bold")
        pdf.setFontSize(24)
        pdf.setTextColor(45, 50, 56)
        pdf.text(record.type, 60, 104)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(12)
        pdf.text(`Date: ${record.date}`, 60, 146)
        pdf.text(`Author: ${record.doctorFull}`, 60, 172)
        pdf.text("Summary", 60, 218)
        pdf.setTextColor(90, 96, 91)
        pdf.text(pdf.splitTextToSize(record.summary, 470), 60, 246)
        pdf.save(`careos-record-${record.id}.pdf`)
    }

    return (
        <>
            <div className="space-y-6">
                <PageIntro
                    eyebrow="Shared Module"
                    title="Medical Records"
                    description="Record summaries are displayed in a clean, accessible table with just enough detail to support a quick clinical read."
                    actions={<Button variant="subtle" onClick={handleFilter}>Filter: {filterLabel}</Button>}
                />

                <Card className="p-6">
                    <div className="responsive-table scroll-table rounded-[24px] border border-[var(--line)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--panel-muted)] text-[var(--muted)]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Record Type</th>
                                    <th className="px-4 py-3 font-semibold">Doctor</th>
                                    <th className="px-4 py-3 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRecords.map((record) => (
                                    <tr key={record.id} className="border-t border-[var(--line)] text-[var(--ink)]">
                                        <td data-label="Date" className="px-4 py-4">{record.date}</td>
                                        <td data-label="Record Type" className="px-4 py-4">{record.type}</td>
                                        <td data-label="Doctor" className="px-4 py-4 text-[var(--muted)]">{record.doctorFull}</td>
                                        <td data-label="Action" className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="subtle" className="px-4 py-2" onClick={() => setSelectedRecord(record)}>
                                                    View
                                                </Button>
                                                <Button variant="subtle" className="px-4 py-2" onClick={() => downloadRecord(record)}>
                                                    Download
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!visibleRecords.length ? (
                                    <tr className="border-t border-[var(--line)] text-[var(--muted)]">
                                        <td colSpan="4" className="px-4 py-6 text-center">No records matched the current filter.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <Modal open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} title={selectedRecord?.type}>
                <div className="space-y-4">
                    <p><strong>Date:</strong> {selectedRecord?.date}</p>
                    <p><strong>Author:</strong> {selectedRecord?.doctorFull}</p>
                    <p className="mt-4">{selectedRecord?.summary}</p>
                    <div className="flex justify-end">
                        <Button onClick={() => downloadRecord(selectedRecord)}>Download PDF</Button>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default MedicalRecords
