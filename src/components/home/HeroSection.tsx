import { Sparkles, CheckCircle2, ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function HeroBackground() {
  return (
    <>
      {/* Subtle gradient fade below navbar */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[60px] h-24 navbar-fade z-0" />

      {/* Layered hero background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Primary glow — top center */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.22), rgba(255,69,0,0))",
            filter: "blur(40px)",
          }}
        />
        {/* Secondary glow — bottom left */}
        <div
          className="absolute top-[60%] -left-40 h-[520px] w-[520px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(59,130,246,0.10), rgba(59,130,246,0))",
            filter: "blur(60px)",
          }}
        />
        {/* Accent glow — right */}
        <div
          className="absolute top-[20%] -right-40 h-[520px] w-[520px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.10), rgba(255,69,0,0))",
            filter: "blur(70px)",
          }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 hero-bg-grid opacity-60" />
        {/* Noise */}
        <div className="absolute inset-0 hero-bg-noise" />
        {/* Floating orbs */}
        <div className="orb orb-1" style={{ top: "10%", left: "-80px", height: "300px", width: "300px", background: "rgba(255,69,0,0.04)", filter: "blur(80px)" }} />
        <div className="orb orb-2" style={{ bottom: "-100px", right: "-120px", height: "400px", width: "400px", background: "rgba(120,60,255,0.04)", filter: "blur(100px)" }} />
        <div className="orb orb-3" style={{ top: "45%", right: "10%", height: "200px", width: "200px", background: "rgba(255,69,0,0.03)", filter: "blur(60px)" }} />
      </div>
    </>
  );
}

export function HeroHeadline() {
  const navigate = useNavigate();

  return (
    <div className="text-center mb-8 md:mb-10">
      {/* Animated badge */}
      <div
        className="hero-rise inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium mb-6 text-primary"
        style={{ background: "rgba(255,69,0,0.1)", border: "1px solid rgba(255,69,0,0.3)", animationDelay: "0ms" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        AI-Powered · Real Reddit Data · Live Analysis
      </div>

      {/* Main headline */}
      <h1
        className="hero-rise text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-bold tracking-tight mb-5 leading-[1.05]"
        style={{ animationDelay: "120ms" }}
      >
        Stop Guessing.
        <br />
        <span className="gradient-text-orange font-extrabold">Start Validating.</span>
      </h1>

      {/* Sub-headline */}
      <p
        className="hero-rise text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 px-2 leading-relaxed"
        style={{ animationDelay: "240ms" }}
      >
        Scan millions of Reddit conversations. Get AI-powered pain points, revenue models, and a{" "}
        <span className="text-foreground font-medium">build-or-skip verdict</span> in under 60 seconds.
      </p>

      {/* Trust signals row */}
      <div
        className="hero-rise flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground/80 mb-8"
        style={{ animationDelay: "340ms" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-500" />
          <span>10M+ posts indexed</span>
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          <span>2,400+ ideas validated</span>
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-blue-400" />
          <span>Trusted by founders</span>
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span>Free to start</span>
        </span>
      </div>

      {/* CTA row — visible on mobile only (desktop uses the search card) */}
      <div
        className="hero-rise sm:hidden flex flex-col gap-3 px-4"
        style={{ animationDelay: "460ms" }}
      >
        <button
          onClick={() => window.scrollTo({ top: document.getElementById("search-card")?.offsetTop ?? 400, behavior: "smooth" })}
          className="gradient-orange text-white font-semibold py-3 px-6 rounded-xl text-[15px] shadow-glow-strong hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="h-4 w-4" /> Start Free Research
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate("/pricing")}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          View pricing →
        </button>
      </div>
    </div>
  );
}
