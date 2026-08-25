function Card({ className = "", children }) {
    return (
        <section className={`rounded-[28px] border border-[rgba(223,216,205,0.9)] bg-[rgba(255,250,244,0.96)] shadow-[0_18px_50px_rgba(28,46,74,0.08)] ${className}`}>
            {children}
        </section>
    )
}

export default Card
