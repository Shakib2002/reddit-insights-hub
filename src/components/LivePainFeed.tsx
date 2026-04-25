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
    <section className="mt-10 fade-in" aria-label="Live Reddit pain feed">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
        </span>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          🔴 Live from Reddit
        </h2>
      </div>
      <div
        className={`grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 transition-opacity duration-200 ${fading ? "opacity-50" : "opacity-100"}`}
      >
        {visible.map((item, i) => (
          <button
            key={`${idx}-${i}`}
            type="button"
            onClick={() => onPick(item.topic)}
            className="text-left"
          >
            <Card className="p-3 h-full hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
              <p className="text-xs leading-relaxed line-clamp-3 text-foreground">
                "{item.quote}"
              </p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[60%]">
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
