import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalysisState, subscribeAnalysis, type AnalysisStatus } from "@/lib/background-analysis";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

const statusConfig: Record<AnalysisStatus, { label: string; icon: any; color: string }> = {
  idle: { label: "", icon: null, color: "" },
  fetching: { label: "Fetching Reddit posts...", icon: Loader2, color: "text-orange-400" },
  analyzing: { label: "AI analyzing...", icon: Loader2, color: "text-blue-400" },
  saving: { label: "Saving results...", icon: Loader2, color: "text-purple-400" },
  done: { label: "Analysis complete!", icon: CheckCircle2, color: "text-green-400" },
  error: { label: "Analysis failed", icon: XCircle, color: "text-red-400" },
};

/**
 * Floating notification bar that shows analysis progress.
 * Renders globally (in App.tsx) so it persists across page navigation.
 */
export function AnalysisProgressBar() {
  const [state, setState] = useState(getAnalysisState());
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeAnalysis(() => setState({ ...getAnalysisState() }));
  }, []);

  // Don't show if idle
  if (state.status === "idle") return null;

  const config = statusConfig[state.status];
  const Icon = config.icon;
  const isRunning = ["fetching", "analyzing", "saving"].includes(state.status);
  const isDone = state.status === "done";

  // Auto-hide after 8 seconds on done
  useEffect(() => {
    if (isDone) {
      const t = setTimeout(() => setState({ status: "idle", keyword: "" }), 8000);
      return () => clearTimeout(t);
    }
  }, [isDone]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl
          ${isDone ? "bg-green-500/10 border-green-500/30" : state.status === "error" ? "bg-red-500/10 border-red-500/30" : "bg-background/95 border-border"}
          min-w-[280px] max-w-[380px]
        `}
      >
        {Icon && (
          <Icon
            className={`h-5 w-5 ${config.color} ${isRunning ? "animate-spin" : ""}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {state.keyword && `"${state.keyword}"`}
            {state.error && ` — ${state.error}`}
          </p>
        </div>
        {isDone && (
          <button
            onClick={() => {
              navigate("/results");
              setState({ status: "idle", keyword: "" });
            }}
            className="flex items-center gap-1 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
          >
            View <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
