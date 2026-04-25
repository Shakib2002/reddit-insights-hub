import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrendSignal } from "@/lib/types";

const trendStyles: Record<TrendSignal["direction"], { emoji: string; label: string; cls: string }> = {
  Growing: { emoji: "📈", label: "Growing", cls: "text-success" },
  Stable: { emoji: "➡️", label: "Stable", cls: "text-muted-foreground" },
  Declining: { emoji: "📉", label: "Declining", cls: "text-destructive" },
};

export function TrendStatCard({ trend }: { trend?: TrendSignal }) {
  const t = trend ?? { direction: "Stable" as const, reason: "Not enough data to detect a trend." };
  const style = trendStyles[t.direction];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col justify-center px-6 py-5 md:px-8 bg-card rounded-xl border border-border cursor-help min-w-[140px]">
            <div className="text-[11px] uppercase tracking-[2px] text-[#555566] font-semibold">
              Trend
            </div>
            <div
              className={`mt-2 truncate text-[24px] md:text-[28px] font-bold leading-none ${
                t.direction === "Growing"
                  ? "stat-glow-green"
                  : t.direction === "Declining"
                    ? "stat-glow-red"
                    : "text-foreground"
              }`}
            >
              {style.emoji} {style.label}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{t.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
