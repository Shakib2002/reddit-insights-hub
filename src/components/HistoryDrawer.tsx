import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getHistory, clearHistory } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

export const HistoryDrawer = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (open) setItems(getHistory());
  }, [open]);

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

  const onClear = () => {
    clearHistory();
    setItems([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HistoryIcon className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Search history</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {items.length === 0 ? (
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
          <Button
            variant="outline"
            onClick={onClear}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Clear history
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
};
