import { LoadingSteps, type LoadingStep } from "@/components/LoadingSteps";
import { Sparkles } from "lucide-react";

interface LoadingOverlayProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  steps: LoadingStep[];
  progress?: number;
}

/**
 * Full-page premium loading overlay matching the redesigned dark SaaS theme.
 * Visual-only — no logic changes. Shows step-by-step progress with checkmarks.
 */
export function LoadingOverlay({
  open,
  title = "Researching Reddit…",
  subtitle = "Hang tight — we're scanning real conversations and surfacing the signal.",
  steps,
  progress,
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8 no-print"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />

      {/* Ambient orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,69,0,0.35), rgba(255,69,0,0))",
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md fade-in">
        <div
          aria-hidden
          className="absolute -inset-px rounded-[22px] bg-gradient-to-br from-primary/40 via-primary/10 to-transparent blur-md opacity-70"
        />
        <div className="relative rounded-[20px] border border-border bg-card shadow-card-lg p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3 mb-5">
            <div className="relative">
              <div className="h-12 w-12 rounded-full gradient-orange flex items-center justify-center pulse-glow">
                <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium tracking-wider uppercase text-primary">
              <span className="live-dot" /> Working on it
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {subtitle}
            </p>
          </div>

          <LoadingSteps steps={steps} progress={progress} />

          <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
            Usually takes under 60 seconds. Please don't close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}
