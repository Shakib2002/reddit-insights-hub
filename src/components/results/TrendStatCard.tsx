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
          <div className="flex flex-col justify-center p-4 md:p-5 bg-background/70 backdrop-blur rounded-lg border border-border cursor-help">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Trend
            </div>
            <div className={`mt-1 truncate font-bold text-lg md:text-xl ${style.cls}`}>
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
