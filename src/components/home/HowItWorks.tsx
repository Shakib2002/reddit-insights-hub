import { Card } from "@/components/ui/card";
import { Search, Zap, BarChart3, ArrowRight } from "lucide-react";

const STEPS = [
  { n: "01", icon: Search, title: "Enter your idea", desc: "Type a keyword or describe your app concept." },
  { n: "02", icon: Zap, title: "AI scans Reddit", desc: "We fetch and analyze hundreds of real discussions." },
  { n: "03", icon: BarChart3, title: "Get insights", desc: "Receive a full report with pain points & verdict." },
];

export function HowItWorks() {
  return (
    <section className="bg-muted/30 border-y border-border py-16 md:py-20">
      <div className="container max-w-5xl">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">How it works</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            From idea to insight in 3 steps
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 relative">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <Card className="p-5 md:p-6 h-full hover:shadow-md transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl font-bold text-primary/30 tabular-nums">{s.n}</span>
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <s.icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </Card>
              {i < 2 && (
                <ArrowRight className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 z-10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
