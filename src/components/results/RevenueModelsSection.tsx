import { Card } from "@/components/ui/card";
import type { RevenueModel } from "@/lib/types";

const typeStyles: Record<RevenueModel["type"], { color: string; bg: string; border: string }> = {
  Freemium: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)" },
  "B2B SaaS": { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)" },
  Marketplace: { color: "#22C55E", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)" },
  "One-time": { color: "#FF4500", bg: "rgba(255,69,0,0.12)", border: "rgba(255,69,0,0.35)" },
};

export function RevenueModelsSection({ models }: { models: RevenueModel[] }) {
  if (!models || models.length === 0) return null;
  return (
    <section id="revenue" className="reveal-up scroll-mt-32">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold section-accent">Revenue Models</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Three monetization paths backed by Reddit signals.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {models.length} options
        </span>
      </div>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {models.map((m, i) => {
          const ts = typeStyles[m.type];
          return (
            <Card
              key={i}
              className={`relative p-5 flex flex-col transition-all duration-200 hover:-translate-y-0.5 ${
                m.recommended ? "border-[rgba(255,69,0,0.5)]" : ""
              }`}
              style={
                m.recommended
                  ? { boxShadow: "0 0 0 1px rgba(255,69,0,0.5), 0 8px 32px rgba(255,69,0,0.12)" }
                  : undefined
              }
            >
              {m.recommended && <span className="recommended-badge">⭐ RECOMMENDED</span>}
              <span
                className="inline-flex items-center w-fit text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                style={{ color: ts.color, background: ts.bg, borderColor: ts.border }}
              >
                {m.type}
              </span>
              <h3 className="font-bold text-base mt-3 leading-tight text-foreground">{m.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3 flex-1 leading-relaxed">
                {m.description}
              </p>
              <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                <div
                  className="text-[20px] font-bold tabular-nums"
                  style={{ color: "#22C55E" }}
                >
                  {m.mrrRange}
                </div>
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  💬 {m.redditEvidence}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
