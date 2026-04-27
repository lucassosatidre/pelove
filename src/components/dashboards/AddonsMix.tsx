import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useTopAddons, type SaleType } from "@/hooks/useSaiposDashboards";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AddonsMix({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useTopAddons(start, end, saleTypes, 30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="w-5 h-5" /> Adicionais e complementos mais pedidos
        </CardTitle>
        <CardDescription>
          Quais adicionais saem mais junto com cada produto. Útil pra cardápio, bundles e treino de equipe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem adicionais no período</p>
        ) : (
          <div className="space-y-1">
            {data.map((a, i) => {
              const max = data[0].uses;
              const pct = max > 0 ? (a.uses / max) * 100 : 0;
              return (
                <div key={a.addon_name} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-border/40 last:border-0">
                  <div className="col-span-1 text-xs text-muted-foreground tabular-nums">#{i + 1}</div>
                  <div className="col-span-4 text-sm font-medium capitalize" title={a.addon_name}>{a.addon_name}</div>
                  <div className="col-span-4 flex gap-1 flex-wrap">
                    {a.parent_products.slice(0, 3).map((pp) => (
                      <Badge key={pp} variant="outline" className="text-[10px] px-1 py-0 truncate max-w-[140px]" title={pp}>{pp}</Badge>
                    ))}
                    {a.parent_products.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">+{a.parent_products.length - 3}</Badge>
                    )}
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs font-medium tabular-nums w-12 text-right">{a.uses}x</div>
                  </div>
                  {a.total_additional_value > 0 && (
                    <div className="col-span-12 sm:col-span-12 text-[10px] text-muted-foreground text-right">
                      Receita extra: {fmtBRL(a.total_additional_value)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
