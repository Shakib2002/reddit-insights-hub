export function StatsStrip() {
  return (
    <section className="stats-bg py-16 md:py-20 relative z-10">
      <div className="container max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { v: "10M+", l: "Reddit posts indexed" },
            { v: "2,400+", l: "Ideas validated" },
            { v: "<60s", l: "Average analysis time" },
            { v: "100%", l: "Free to use" },
          ].map((s) => (
            <div key={s.l} className="text-center p-4 rounded-lg">
              <div className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                {s.v}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
