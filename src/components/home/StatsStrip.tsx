import { useEffect, useState, useRef } from "react";

const STATS = [
  { target: 10, suffix: "M+", label: "Reddit posts indexed" },
  { target: 2400, suffix: "+", label: "Ideas validated" },
  { target: 60, suffix: "s", label: "Average analysis", prefix: "<" },
  { target: 3, suffix: " tiers", label: "Free tier included" },
];

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export function StatsStrip() {
  return (
    <section className="relative py-16 md:py-24 z-10 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 stats-bg" />
      {/* Subtle glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(255,69,0,0.06), transparent)", filter: "blur(60px)" }}
      />

      <div className="container max-w-5xl relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center group">
              <div className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-primary via-orange-400 to-primary/60 bg-clip-text text-transparent mb-1 group-hover:scale-105 transition-transform">
                {s.prefix}
                <AnimatedCounter target={s.target} />
                {s.suffix}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
