import { Sparkles, CheckCircle2 } from "lucide-react";

export function HeroBackground() {
  return (
    <>
      {/* Subtle gradient fade below navbar */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[60px] h-24 navbar-fade z-0" />

      {/* Layered hero background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Radial glow — top center orange */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.18), rgba(255,69,0,0))",
            filter: "blur(40px)",
          }}
        />
        {/* Radial glow — bottom left blue tint */}
        <div
          className="absolute top-[60%] -left-40 h-[520px] w-[520px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(59,130,246,0.10), rgba(59,130,246,0))",
            filter: "blur(60px)",
          }}
        />
        {/* Radial glow — right side */}
        <div
          className="absolute top-[20%] -right-40 h-[520px] w-[520px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.10), rgba(255,69,0,0))",
            filter: "blur(70px)",
          }}
        />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 hero-bg-grid opacity-60" />
        {/* Noise texture overlay */}
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
  return (
    <div className="text-center mb-8 md:mb-10">
      <div
        className="hero-rise inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium mb-6 text-primary"
        style={{ background: "rgba(255,69,0,0.1)", border: "1px solid rgba(255,69,0,0.3)", animationDelay: "0ms" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Powered by AI · Real Reddit data
      </div>
      <h1
        className="hero-rise text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-bold tracking-tight mb-4 leading-[1.05]"
        style={{ animationDelay: "120ms" }}
      >
        Find Real Problems
        <br />
        <span className="gradient-text-orange font-extrabold">Worth Building</span>
      </h1>
      <p
        className="hero-rise text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-6 px-2 leading-relaxed"
        style={{ animationDelay: "240ms" }}
      >
        Validate startup ideas in 30 seconds. Get AI-powered pain points, revenue models, and competitor gaps from real Reddit discussions.
      </p>
      <div
        className="hero-rise flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground/80"
        style={{ animationDelay: "340ms" }}
      >
        <span>2,400+ ideas analyzed</span>
        <span className="text-border">·</span>
        <span>Founder favorite</span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Free to start</span>
      </div>
    </div>
  );
}
