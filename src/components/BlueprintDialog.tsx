import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractEdgeFunctionError } from "@/lib/errors";
import type { Blueprint, PainPoint, ReportLanguage } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appName: string;
  appDescription: string;
  painPoints: PainPoint[];
  language?: ReportLanguage;
}

export const BlueprintDialog = ({
  open,
  onOpenChange,
  appName,
  appDescription,
  painPoints,
  language = "en",
}: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setBlueprint(null);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("blueprint", {
          body: { appName, appDescription, painPoints, language },
        });
        if (error) {
          throw new Error(extractEdgeFunctionError(error));
        }
        if (!cancelled) setBlueprint(data?.blueprint ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to generate blueprint");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, appName, appDescription, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyBlueprint = async () => {
    if (!blueprint) return;
    const text = `BLUEPRINT — ${appName}
================
${appDescription}

Target user: ${blueprint.targetUser}
Revenue model: ${blueprint.revenueModel}
Time to MVP: ${blueprint.timeToMVP}
First milestone: ${blueprint.firstMilestone}

MVP FEATURES
${blueprint.mvpFeatures.map((f, i) => `${i + 1}. ${f}`).join("\n")}

TECH STACK
${blueprint.techStack.join(", ")}
`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Blueprint copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Build This App: {appName}
          </DialogTitle>
          <DialogDescription>{appDescription}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Drafting your MVP blueprint…</p>
          </div>
        )}

        {error && (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {blueprint && !loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Target user" value={blueprint.targetUser} />
              <InfoRow label="Revenue model" value={blueprint.revenueModel} />
              <InfoRow label="Time to MVP" value={blueprint.timeToMVP} />
              <InfoRow label="First milestone" value={blueprint.firstMilestone} />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">MVP features</h3>
              <ol className="space-y-1.5">
                {blueprint.mvpFeatures.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary font-semibold">{i + 1}.</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Tech stack</h3>
              <div className="flex flex-wrap gap-1.5">
                {blueprint.techStack.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={copyBlueprint} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              <Copy className="h-4 w-4" /> Copy Blueprint
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3 bg-muted/30">
    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
    <div className="text-sm font-medium">{value || "—"}</div>
  </div>
);
