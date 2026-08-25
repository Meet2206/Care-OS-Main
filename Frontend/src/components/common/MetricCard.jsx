import Card from "./Card"

function MetricCard({ label, value, note, tone = "blue" }) {
    const tones = {
        blue: "from-[#0f9fb4] to-[#1489b3]",
        green: "from-[#bfe7d0] to-[#92cfaa]",
        sky: "from-[#bcdff7] to-[#8dc6ef]",
    }

    return (
        <Card className={`bg-gradient-to-br ${tones[tone]} p-5 text-white`}>
            <div className="space-y-3">
                <p className="text-sm font-medium text-white/80">{label}</p>
                <p className="text-4xl font-semibold leading-none">{value}</p>
                <div className="h-2 rounded-full bg-white/30">
                    <div className="h-2 w-2/3 rounded-full bg-white/80" />
                </div>
                <p className="text-sm text-white/85">{note}</p>
            </div>
        </Card>
    )
}

export default MetricCard
