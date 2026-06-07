import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { dbListHistory, dbDeleteSearch } from "@/lib/db-history";
import type { HistoryItem } from "@/lib/types";
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Loader2,
  Sparkles,
  Clock,
  BarChart3,
} from "lucide-react";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-400";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    dbListHistory(user.id).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const ok = await dbDeleteSearch(id);
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
    setDeleting(null);
  };

  const handleOpen = (item: HistoryItem) => {
    if (item.kind === "validate") {
      sessionStorage.setItem("redditlens_validate", JSON.stringify(item.payload));
      navigate("/validate?mode=validate");
    } else {
      sessionStorage.setItem("redditlens_results", JSON.stringify(item.payload));
      navigate("/results");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Header />

      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,69,0,0.08), rgba(255,69,0,0))",
            filter: "blur(50px)",
          }}
        />
      </div>

      <main className="container max-w-4xl pt-12 md:pt-20 pb-16 relative z-10">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Saved Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your research history, synced across devices.
            </p>
          </div>
          <Button onClick={() => navigate("/")} className="gap-2 gradient-orange text-white border-0">
            <Search className="h-4 w-4" /> New Search
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <Card className="p-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No saved reports yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Run your first search and your reports will appear here, synced across all your devices.
            </p>
            <Button onClick={() => navigate("/")} className="gap-2">
              <Sparkles className="h-4 w-4" /> Start researching
            </Button>
          </Card>
        )}

        {/* Reports list */}
        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <Card
                key={item.id}
                className="p-4 md:p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => handleOpen(item)}
              >
                {/* Icon */}
                <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                  item.kind === "validate" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500"
                }`}>
                  {item.kind === "validate" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold truncate">{item.keyword}</h3>
                    <span className={`text-sm font-bold tabular-nums ${scoreColor(item.painScore)}`}>
                      {item.painScore}/100
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                </div>

                {/* Meta */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(item.timestamp)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
