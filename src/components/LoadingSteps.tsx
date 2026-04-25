import { Check, Loader2, Circle } from "lucide-react";

export type StepStatus = "pending" | "active" | "done";

export interface LoadingStep {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface LoadingStepsProps {
  title?: string;
  steps: LoadingStep[];
  /** Optional 0-100 progress for the bar. If omitted, derived from done count. */
  progress?: number;
}

export function LoadingSteps({ title, steps, progress }: LoadingStepsProps) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const derived =
    steps.length === 0
      ? 0
      : Math.round(
          ((doneCount + (steps.some((s) => s.status === "active") ? 0.5 : 0)) /
            steps.length) *
            100,
        );
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? derived)));

  return (
    <div className="flex flex-col items-center justify-center gap-5 w-full">
      {title && (
        <p className="text-base md:text-lg font-semibold text-center text-foreground">
          {title}
        </p>
      )}

      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out gradient-orange"
            style={{
              width: `${pct}%`,
              boxShadow: "0 0 12px rgba(255,69,0,0.5)",
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-2 tabular-nums uppercase tracking-wider">
          <span className="text-primary font-semibold">{pct}%</span>
          <span>
            Step {Math.min(doneCount + 1, steps.length)} of {steps.length}
          </span>
        </div>
      </div>

      <ol className="w-full space-y-2" aria-label="Progress steps">
        {steps.map((s) => {
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          return (
            <li
              key={s.key}
              className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 border transition-all duration-200 ${
                isActive
                  ? "border-primary/40 bg-primary/5 shadow-[0_0_24px_rgba(255,69,0,0.08)]"
                  : isDone
                    ? "border-border bg-muted/40"
                    : "border-border/60 bg-background/60"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isDone
                    ? "gradient-orange text-white"
                    : isActive
                      ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-tight ${
                    isActive
                      ? "font-semibold text-foreground"
                      : isDone
                        ? "text-muted-foreground"
                        : "text-muted-foreground/80"
                  }`}
                >
                  {s.label}
                </p>
                {s.detail && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                    {s.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
