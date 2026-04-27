import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, X, AlertTriangle, AlertCircle, CheckCircle2, Info, Loader2, RefreshCw,
} from "lucide-react";
import { useInsights, useDismissInsight, useGenerateInsightsNow } from "@/hooks/useAdvisor";
import { useToast } from "@/hooks/use-toast";

const SEVERITY_STYLE: Record<string, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
  info:     { bg: "bg-blue-500/5",    border: "border-blue-500/30",    icon: <Info className="w-4 h-4" />,            text: "text-blue-700 dark:text-blue-400" },
  success:  { bg: "bg-emerald-500/5", border: "border-emerald-500/30", icon: <CheckCircle2 className="w-4 h-4" />,    text: "text-emerald-700 dark:text-emerald-400" },
  warning:  { bg: "bg-amber-500/5",   border: "border-amber-500/30",   icon: <AlertTriangle className="w-4 h-4" />,   text: "text-amber-700 dark:text-amber-500" },
  critical: { bg: "bg-destructive/5", border: "border-destructive/30", icon: <AlertCircle className="w-4 h-4" />,     text: "text-destructive" },
};

export function InsightsCards() {
  const { data: insights, isLoading } = useInsights();
  const dismiss = useDismissInsight();
  const generate = useGenerateInsightsNow();
  const { toast } = useToast();

  const handleGenerate = async () => {
    try {
      const r = await generate.mutateAsync();
      if ((r as any)?.skipped) {
        toast({ title: "Pulado", description: (r as any).reason });
      } else if ((r as any)?.error) {
        toast({ title: "Erro", description: (r as any).error, variant: "destructive" });
      } else {
        toast({
          title: `${(r as any)?.generated_count ?? 0} insight(s) gerado(s)`,
          description: "Atualizando lista...",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Insights do Advisor</h3>
            {insights && insights.length > 0 && (
              <Badge variant="secondary" className="text-xs">{insights.length}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Gerar agora
          </Button>
        </div>

        {!insights || insights.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Nenhum insight ativo. O cron diário gera automaticamente — ou clique "Gerar agora".
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {insights.slice(0, 3).map((i) => {
              const style = SEVERITY_STYLE[i.severity] ?? SEVERITY_STYLE.info;
              return (
                <div
                  key={i.id}
                  className={`relative ${style.bg} ${style.border} border rounded-lg p-3 group`}
                >
                  <button
                    onClick={() => dismiss.mutate(i.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Dispensar"
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                  <div className={`flex items-center gap-1.5 ${style.text} mb-1`}>
                    {style.icon}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">{i.domain}</Badge>
                  </div>
                  <p className="text-sm font-semibold leading-tight mb-1">{i.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{i.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Sobre {new Date(i.for_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
