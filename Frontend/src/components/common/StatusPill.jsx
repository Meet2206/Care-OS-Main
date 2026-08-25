function StatusPill({ children, tone = "neutral" }) {
    const tones = {
        neutral: "bg-[#eef2f6] text-[#52606d]",
        green: "bg-[#dbefe2] text-[#337a52]",
        amber: "bg-[#f7efd8] text-[#946d12]",
        blue: "bg-[#d8ebf7] text-[#235e89]",
        coral: "bg-[#f9dfdb] text-[#a34e43]",
    }

    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
            {children}
        </span>
    )
}

export default StatusPill
