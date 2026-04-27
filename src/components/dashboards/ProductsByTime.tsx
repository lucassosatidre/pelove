import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductsByHour, useProductsByDow, type SaleType } from "@/hooks/useSaiposDashboards";
import { useMemo } from "react";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ProductsByHour({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useProductsByHour(start, end, saleTypes, 8);

  const { products, matrix, max } = useMemo(() => {
    const p = new Map<string, string>();
    let mx = 0;
    const m: Record<string, Record<number, number>> = {};
    (data ?? []).forEach((r) => {
      if (!p.has(r.normalized_name)) {
        p.set(r.normalized_name, r.display_name);
        m[r.normalized_name] = {};
      }
      m[r.normalized_name][r.hour] = r.quantity;
      if (r.quantity > mx) mx = r.quantity;
    });
    return { products: Array.from(p.entries()), matrix: m, max: mx };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 8 produtos × hora do dia</CardTitle>
        <CardDescription>O que vende mais no almoço vs jantar vs madrugada</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-[2px] min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-normal pr-2 sticky left-0 bg-card"></th>
                  {HOURS.map((h) => (
                    <th key={h} className="text-center text-muted-foreground font-normal w-7">
                      {h % 3 === 0 ? `${h}h` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(([norm, display]) => (
                  <tr key={norm}>
                    <td className="text-foreground pr-2 font-medium text-right truncate max-w-[180px] sticky left-0 bg-card" title={display}>
                      {display}
                    </td>
                    {HOURS.map((h) => {
                      const qty = matrix[norm]?.[h] ?? 0;
                      const intensity = max > 0 ? qty / max : 0;
                      const bg = intensity > 0
                        ? `hsl(var(--primary) / ${(0.1 + intensity * 0.9).toFixed(2)})`
                        : "hsl(var(--muted) / 0.3)";
                      return (
                        <td
                          key={h}
                          className="text-center w-7 h-7 rounded-sm tabular-nums"
                          style={{ background: bg, color: intensity > 0.5 ? "white" : undefined }}
                          title={`${display} ${h}h: ${qty.toLocaleString("pt-BR")} vendidos`}
                        >
                          {qty > 0 ? Math.round(qty) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductsByDow({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useProductsByDow(start, end, saleTypes, 8);

  const { products, matrix, maxByProduct } = useMemo(() => {
    const p = new Map<string, string>();
    const m: Record<string, Record<number, number>> = {};
    const maxByProd: Record<string, number> = {};
    (data ?? []).forEach((r) => {
      if (!p.has(r.normalized_name)) {
        p.set(r.normalized_name, r.display_name);
        m[r.normalized_name] = {};
        maxByProd[r.normalized_name] = 0;
      }
      m[r.normalized_name][r.dow] = r.quantity;
      if (r.quantity > maxByProd[r.normalized_name]) maxByProd[r.normalized_name] = r.quantity;
    });
    return { products: Array.from(p.entries()), matrix: m, maxByProduct: maxByProd };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 8 produtos × dia da semana</CardTitle>
        <CardDescription>Padrão de qual produto vende mais em cada dia (escala por linha)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-[2px] min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-normal pr-2"></th>
                  {DOW_LABELS.map((l) => (
                    <th key={l} className="text-center text-muted-foreground font-normal min-w-12 px-2">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(([norm, display]) => (
                  <tr key={norm}>
                    <td className="text-foreground pr-2 font-medium text-right truncate max-w-[180px]" title={display}>
                      {display}
                    </td>
                    {DOW_LABELS.map((_, d) => {
                      const qty = matrix[norm]?.[d] ?? 0;
                      const max = maxByProduct[norm] || 1;
                      const intensity = qty / max;
                      const bg = intensity > 0
                        ? `hsl(var(--primary) / ${(0.1 + intensity * 0.9).toFixed(2)})`
                        : "hsl(var(--muted) / 0.3)";
                      return (
                        <td
                          key={d}
                          className="text-center min-w-12 h-7 rounded-sm tabular-nums px-2"
                          style={{ background: bg, color: intensity > 0.5 ? "white" : undefined }}
                          title={`${display} ${DOW_LABELS[d]}: ${qty.toLocaleString("pt-BR")}`}
                        >
                          {qty > 0 ? Math.round(qty) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
