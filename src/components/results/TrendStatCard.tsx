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
          <div className="flex flex-col justify-center px-3 md:px-4 py-2 min-w-0 cursor-help pb-4 md:pb-2">
            <div className="text-[10px] uppercase tracking-[1.5px] text-[#555566] font-semibold whitespace-nowrap">
              Trend
            </div>
            <div
              className={`mt-2 text-[18px] md:text-[20px] font-bold leading-none whitespace-nowrap overflow-hidden text-ellipsis ${
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
