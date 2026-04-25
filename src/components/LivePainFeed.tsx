import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeedItem {
  quote: string;
  topic: string;
  signal: "High" | "Medium";
  subreddit: string;
}

interface Props {
  onPick: (topic: string) => void;
}

const signalCls = (s: string) =>
  s === "High"
    ? "bg-primary text-primary-foreground border-transparent"
    : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";

export function LivePainFeed({ onPick }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("feed", { body: {} });
        if (error || cancelled) return;
        if (Array.isArray(data?.items) && data.items.length > 0) {
          setItems(data.items);
        }
      } catch {
        // silent fail — section just hides
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    timerRef.current = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % items.length);
        setFading(false);
      }, 250);
    }, 4000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  // Show 5 cards starting at idx, wrap around
  const visible = Array.from({ length: Math.min(5, items.length) }, (_, k) => items[(idx + k) % items.length]);

  return (
    <section className="mt-12 fade-in" aria-label="Live Reddit pain feed">
      <div className="flex items-center justify-center gap-2.5 mb-5">
        <span className="live-dot" />
        <h2 className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.2em]">
          Live from Reddit
        </h2>
      </div>
      <div
        className={`grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 transition-opacity duration-200 ${fading ? "opacity-50" : "opacity-100"}`}
      >
        {visible.map((item, i) => (
          <button
            key={`${idx}-${i}`}
            type="button"
            onClick={() => onPick(item.topic)}
            className="text-left"
          >
            <Card className="p-4 h-full bg-card border-border hover:border-primary hover:-translate-y-0.5 hover:shadow-glow transition-all cursor-pointer rounded-xl">
              <p className="text-[13px] leading-relaxed line-clamp-3 text-foreground italic">
                "{item.quote}"
              </p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[60%] border-primary/30 text-primary bg-primary/5">
                  {item.topic}
                </Badge>
                <Badge className={`text-[10px] ${signalCls(item.signal)}`}>{item.signal}</Badge>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
