import { Card } from "@/components/ui/card";
import { Target, DollarSign, CheckCircle2, Swords, Brain, LineChart } from "lucide-react";

const FEATURES = [
  {
    icon: Target,
    title: "Pain Point Detection",
    desc: "Surface real frustrations from thousands of authentic Reddit discussions — not AI hallucinations.",
    color: "from-red-500/20 to-red-500/5 border-red-500/20",
    iconColor: "text-red-400",
  },
  {
    icon: DollarSign,
    title: "Revenue Models",
    desc: "Get pricing benchmarks, MRR potential, and proven monetization strategies with real-world comparisons.",
    color: "from-green-500/20 to-green-500/5 border-green-500/20",
    iconColor: "text-green-400",
  },
  {
    icon: CheckCircle2,
    title: "Build or Skip Verdict",
    desc: "AI-powered go/no-go decision based on demand signals, competition intensity, and market feasibility.",
    color: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20",
    iconColor: "text-yellow-400",
  },
  {
    icon: Swords,
    title: "Competitor Intelligence",
    desc: "Auto-discover competitors, analyze gaps, and find blue-ocean opportunities others missed.",
    color: "from-blue-500/20 to-blue-500/5 border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Brain,
    title: "MVP Blueprint",
    desc: "Get an AI-generated technical roadmap with tech stack, features to build first, and launch timeline.",
    color: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: LineChart,
    title: "Compare Mode",
    desc: "Head-to-head keyword battle — compare two ideas side by side and pick the winner.",
    color: "from-primary/20 to-primary/5 border-primary/20",
    iconColor: "text-primary",
  },
];

export function FeatureCards() {
  return (
    <section className="features-bg py-20 md:py-28 relative z-10">
      <div className="container max-w-6xl">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Everything you need to validate ideas
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-base">
            Stop guessing what to build. Use real data from millions of Reddit conversations.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              className={`p-6 hover:shadow-xl transition-all duration-300 group relative overflow-hidden bg-gradient-to-b ${f.color}`}
            >
              {/* Subtle hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-b from-white/[0.02] to-transparent" />

              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 ${f.iconColor} mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300`}>
                <f.icon className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-semibold text-[15px] mb-2 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
