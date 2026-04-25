import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RevenueModel } from "@/lib/types";

const typeStyles: Record<RevenueModel["type"], string> = {
  Freemium: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "B2B SaaS": "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  Marketplace: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  "One-time": "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
};

export function RevenueModelsSection({ models }: { models: RevenueModel[] }) {
  if (!models || models.length === 0) return null;
  return (
    <section id="revenue" className="fade-in scroll-mt-32">
      <h2 className="text-xl font-semibold mb-1">Revenue Models</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Three monetization paths backed by Reddit signals.
      </p>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {models.map((m, i) => (
          <Card
            key={i}
            className={`p-4 md:p-5 flex flex-col relative ${m.recommended ? "border-primary border-2" : ""}`}
          >
            {m.recommended && (
              <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground border-transparent">
                ✓ RECOMMENDED
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs w-fit ${typeStyles[m.type]}`}>
              {m.type}
            </Badge>
            <h3 className="font-bold text-base mt-2 leading-tight">{m.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-3 flex-1">
              {m.description}
            </p>
            <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
              <div className="text-sm font-semibold tabular-nums text-success">
                {m.mrrRange}
              </div>
              <p className="text-xs text-muted-foreground italic">
                💬 {m.redditEvidence}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
