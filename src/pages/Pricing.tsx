import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/pricing";
import { Check, Sparkles, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();

  // Load LemonSqueezy script
  useEffect(() => {
    if (document.getElementById("lemonsqueezy-js")) {
      if ((window as any).createLemonSqueezy) {
        (window as any).createLemonSqueezy();
      }
      return;
    }
    const script = document.createElement("script");
    script.id = "lemonsqueezy-js";
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Header />

      {/* Subtle background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.12), rgba(255,69,0,0))",
            filter: "blur(50px)",
          }}
        />
      </div>

      <main className="container max-w-5xl pt-16 md:pt-24 pb-16 md:pb-24 relative z-10">
        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium mb-4 text-primary" style={{ background: "rgba(255,69,0,0.1)", border: "1px solid rgba(255,69,0,0.3)" }}>
            <Sparkles className="h-3.5 w-3.5" />
            Simple, transparent pricing
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Choose your plan
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Start free, upgrade when you need more. Cancel anytime.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all hover:shadow-lg ${
                plan.popular
                  ? "border-primary bg-primary/[0.03] shadow-md scale-[1.02]"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-glow-strong">
                  Most Popular
                </div>
              )}
              <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                {plan.priceNote && (
                  <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
                )}
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.tier === "free" ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate("/")}
                >
                  Current Plan
                </Button>
              ) : plan.checkoutUrl ? (
                <a href={plan.checkoutUrl} className="lemonsqueezy-button">
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

        {/* FAQ / Trust */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            🔒 Secure payments powered by LemonSqueezy. Cancel anytime with one click.
            All plans include a 7-day money-back guarantee.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
