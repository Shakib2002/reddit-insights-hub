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
    <div className="flex flex-col items-center justify-center py-8 gap-5 w-full">
      {title && (
        <p className="text-base md:text-lg font-medium text-center">{title}</p>
      )}

      <div className="w-full max-w-md">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2 tabular-nums">
          <span>{pct}%</span>
          <span>
            Step {Math.min(doneCount + 1, steps.length)} of {steps.length}
          </span>
        </div>
      </div>

      <ol className="w-full max-w-md space-y-2.5" aria-label="Progress steps">
        {steps.map((s) => {
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          return (
            <li
              key={s.key}
              className={`flex items-start gap-3 rounded-md px-3 py-2 border transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/5"
                  : isDone
                    ? "border-border bg-muted/30"
                    : "border-border/60 bg-background"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Circle className="h-3 w-3" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-tight ${
                    isActive
                      ? "font-semibold text-foreground"
                      : isDone
                        ? "text-muted-foreground line-through decoration-muted-foreground/40"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </p>
                {s.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
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
