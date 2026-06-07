import { Search, Zap, BarChart3, ArrowRight } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Search,
    title: "Enter your idea",
    desc: "Type a keyword, app concept, or niche market you want to explore.",
    accent: "from-blue-500 to-blue-600",
  },
  {
    n: "02",
    icon: Zap,
    title: "AI scans Reddit",
    desc: "We fetch and analyze hundreds of real discussions using DeepSeek AI.",
    accent: "from-primary to-orange-600",
  },
  {
    n: "03",
    icon: BarChart3,
    title: "Get your report",
    desc: "Receive pain points, revenue models, competitor gaps, and a build-or-skip verdict.",
    accent: "from-green-500 to-emerald-600",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute inset-0 border-y border-border/40" />

      <div className="container max-w-5xl relative z-10">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            From idea to insight in 60 seconds
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Three simple steps. No signup required for your first search.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-[52px] left-[20%] right-[20%] h-px bg-gradient-to-r from-border via-primary/30 to-border" />

          {STEPS.map((s, i) => (
            <div key={s.n} className="relative group">
              {/* Step number + icon */}
              <div className="flex flex-col items-center mb-5">
                <div className={`relative h-[72px] w-[72px] rounded-2xl bg-gradient-to-br ${s.accent} p-[1px] shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}>
                  <div className="h-full w-full rounded-2xl bg-card flex items-center justify-center">
                    <s.icon className="h-7 w-7 text-foreground" />
                  </div>
                  {/* Step badge */}
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-[11px] font-bold flex items-center justify-center text-white shadow-md">
                    {i + 1}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="font-semibold text-base mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">{s.desc}</p>
              </div>

              {/* Arrow between steps — desktop */}
              {i < 2 && (
                <ArrowRight className="hidden md:block absolute top-[36px] -right-3 h-5 w-5 text-primary/40 z-10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
