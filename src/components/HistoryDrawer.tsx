import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon, Trash2, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getHistory, clearHistory } from "@/lib/history";
import { dbDeleteSearch, dbListHistory } from "@/lib/db-history";
import { useAuth } from "@/hooks/useAuth";
import type { HistoryItem } from "@/lib/types";

export const HistoryDrawer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fromDb = !!user;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (fromDb && user) {
      setLoading(true);
      dbListHistory(user.id).then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setLoading(false);
        }
      });
    } else {
      setItems(getHistory());
    }
    return () => {
      cancelled = true;
    };
  }, [open, fromDb, user]);

  const openItem = (item: HistoryItem) => {
    if (item.kind === "validate") {
      sessionStorage.setItem("redditlens_validate", JSON.stringify(item.payload));
      setOpen(false);
      navigate("/validate");
      return;
    }
    sessionStorage.setItem("redditlens_results", JSON.stringify(item.payload));
    setOpen(false);
    navigate("/results");
  };

  const onClear = async () => {
    if (fromDb) {
      // Delete each row owned by the user
      await Promise.all(items.map((it) => dbDeleteSearch(it.id)));
    } else {
      clearHistory();
    }
    setItems([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Open search history">
          <HistoryIcon className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Search history</SheetTitle>
          {!fromDb && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 pt-1">
              <CloudOff className="h-3.5 w-3.5" /> Saved on this device only.{" "}
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/auth");
                }}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>{" "}
              to sync.
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No saved searches yet.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => openItem(item)}
                className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold truncate flex-1">{item.keyword}</h3>
                  <Badge className="bg-primary text-primary-foreground shrink-0">
                    {item.painScore}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                  {item.kind === "validate" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      Validate
                    </Badge>
                  )}
                </div>
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {items.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Clear history
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all search history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {items.length} saved {items.length === 1 ? "search" : "searches"}.
                  {fromDb ? " This cannot be undone." : " Local data will be removed from this device."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClear}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </SheetContent>
    </Sheet>
  );
};
