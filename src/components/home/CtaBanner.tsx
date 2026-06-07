import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  const navigate = useNavigate();

  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.15), transparent)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="container max-w-3xl relative z-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-primary mb-6"
          style={{ background: "rgba(255,69,0,0.1)", border: "1px solid rgba(255,69,0,0.25)" }}
        >
          <Sparkles className="h-3 w-3" />
          Start free · No credit card required
        </div>

        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
          Ready to find your next{" "}
          <span className="gradient-text-orange">million-dollar idea</span>?
        </h2>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-8">
          Join 2,400+ founders who validate their startup ideas with real Reddit data before writing a single line of code.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="gradient-orange text-white font-semibold text-[15px] h-[52px] px-8 rounded-xl shadow-glow-strong hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(255,69,0,0.5)] transition-all border-0 gap-2"
          >
            Start Free Research
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/pricing")}
            className="h-[52px] px-8 rounded-xl text-[15px]"
          >
            View Pricing
          </Button>
        </div>
      </div>
    </section>
  );
}
