import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Trophy } from "lucide-react";
import { useState, useMemo } from "react";
import { useTopProducts, type SaleType } from "@/hooks/useSaiposDashboards";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function ProductRanking({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useTopProducts(start, end, saleTypes, 50);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data;
    return data.filter(
      (p) => p.display_name.toLowerCase().includes(q) || p.normalized_name.includes(q),
    );
  }, [data, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Ranking de produtos
            </CardTitle>
            <CardDescription>
              Mesmo produto vendido em canais diferentes (Salão / Delivery / iFood) é agrupado.
            </CardDescription>
          </div>
          <div className="relative w-60">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">
            {data?.length === 0 ? "Sem itens vendidos no período" : "Nenhum produto bate com o filtro"}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((p, i) => {
              const max = filtered[0].revenue;
              const pct = max > 0 ? (p.revenue / max) * 100 : 0;
              return (
                <div key={p.normalized_name} className="grid grid-cols-12 gap-2 items-center py-1 border-b border-border/40 last:border-0">
                  <div className="col-span-1 text-xs text-muted-foreground tabular-nums">#{i + 1}</div>
                  <div className="col-span-5 text-sm font-medium truncate" title={p.display_name}>{p.display_name}</div>
                  <div className="col-span-2 flex gap-1 flex-wrap">
                    {p.channels.slice(0, 3).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">{c}</Badge>
                    ))}
                  </div>
                  <div className="col-span-1 text-xs text-muted-foreground text-right tabular-nums">{fmtNum(p.quantity)}x</div>
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs font-medium tabular-nums w-20 text-right">{fmtBRL(p.revenue)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
