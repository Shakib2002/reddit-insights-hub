import { Card } from "@/components/ui/card";
import { Target, DollarSign, CheckCircle2 } from "lucide-react";

const FEATURES = [
  {
    icon: Target,
    title: "Pain Point Detection",
    desc: "Surface real frustrations from authentic Reddit discussions, not AI hallucinations.",
    color: "text-primary bg-primary/10",
  },
  {
    icon: DollarSign,
    title: "Revenue Models",
    desc: "Get pricing benchmarks, MRR potential, and proven monetization strategies.",
    color: "text-success bg-success/10",
  },
  {
    icon: CheckCircle2,
    title: "Build or Skip Verdict",
    desc: "AI-powered go/no-go decision based on demand, competition, and feasibility.",
    color: "text-yellow-600 bg-yellow-500/10",
  },
];

export function FeatureCards() {
  return (
    <section className="features-bg py-16 md:py-20 relative z-10">
      <div className="container max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Everything you need to validate ideas
          </h2>
          <p className="text-muted-foreground">
            Stop guessing. Start building what people actually want.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5 md:p-6 hover:border-primary/40 hover:shadow-md transition-all group">
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${f.color} mb-3 group-hover:scale-110 transition-transform`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
