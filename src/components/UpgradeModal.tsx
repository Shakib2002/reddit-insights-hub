import { useEffect } from "react";
import { X, Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/pricing";
import { getRemainingSearches } from "@/lib/usage";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "limit" | "feature";
  featureName?: string;
}

export function UpgradeModal({ open, onClose, reason = "limit", featureName }: UpgradeModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Load LemonSqueezy script
  useEffect(() => {
    if (!open) return;
    if (document.getElementById("lemonsqueezy-js")) return;
    const script = document.createElement("script");
    script.id = "lemonsqueezy-js";
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      // Don't remove — let it persist for future checkouts
    };
  }, [open]);

  // Re-init LemonSqueezy buttons after render
  useEffect(() => {
    if (open && (window as any).createLemonSqueezy) {
      (window as any).createLemonSqueezy();
    }
  }, [open]);

  if (!open) return null;

  const remaining = getRemainingSearches("free");
  const paidPlans = PLANS.filter((p) => p.tier !== "free");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 text-center border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
            <Sparkles className="h-3 w-3" />
            Upgrade to unlock
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            {reason === "limit"
              ? "You've used all 3 free searches this month"
              : `${featureName ?? "This feature"} requires a paid plan`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {reason === "limit"
              ? "Upgrade to get unlimited searches and premium features."
              : "Choose a plan to unlock all premium features."}
          </p>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {paidPlans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-xl border p-5 flex flex-col transition-all hover:shadow-md ${
                plan.popular
                  ? "border-primary bg-primary/[0.03] shadow-sm"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-primary text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1 mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
              </div>
              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan.checkoutUrl ? (
                <a
                  href={plan.checkoutUrl}
                  className="lemonsqueezy-button"
                >
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "gradient-orange text-white border-0 shadow-glow-strong hover:-translate-y-0.5 transition-all"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    <Zap className="h-4 w-4" />
                    Get {plan.name}
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="lg" disabled className="w-full">
                  Coming soon
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-muted-foreground">
            {remaining > 0
              ? `${remaining} free search${remaining === 1 ? "" : "es"} remaining this month.`
              : "Free searches reset on the 1st of each month."}{" "}
            Cancel anytime. Powered by LemonSqueezy.
          </p>
        </div>
      </div>
    </div>
  );
}
