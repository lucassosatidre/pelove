import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesHeatmap, type SaleType } from "@/hooks/useSaiposDashboards";
import { useMemo } from "react";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function HourHeatmap({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useSalesHeatmap(start, end, saleTypes);

  const { matrix, max } = useMemo(() => {
    const m: Record<number, Record<number, { revenue: number; orders: number }>> = {};
    let mx = 0;
    for (let d = 0; d < 7; d++) {
      m[d] = {};
      for (let h = 0; h < 24; h++) m[d][h] = { revenue: 0, orders: 0 };
    }
    (data ?? []).forEach((c) => {
      m[c.dow][c.hour] = { revenue: c.revenue, orders: c.orders };
      if (c.revenue > mx) mx = c.revenue;
    });
    return { matrix: m, max: mx };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Curva de vendas por hora × dia</CardTitle>
        <CardDescription>Faturamento por horário, baseado na hora do pedido (created_at)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : max === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-[2px] min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-normal pr-2"></th>
                  {HOURS.map((h) => (
                    <th key={h} className="text-center text-muted-foreground font-normal w-7">
                      {h % 3 === 0 ? `${h}h` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOW_LABELS.map((label, d) => (
                  <tr key={d}>
                    <td className="text-muted-foreground pr-2 font-medium text-right">{label}</td>
                    {HOURS.map((h) => {
                      const cell = matrix[d][h];
                      const intensity = max > 0 ? cell.revenue / max : 0;
                      const bg = intensity > 0
                        ? `hsl(var(--primary) / ${(0.1 + intensity * 0.9).toFixed(2)})`
                        : "hsl(var(--muted) / 0.3)";
                      return (
                        <td
                          key={h}
                          className="text-center w-7 h-7 rounded-sm tabular-nums"
                          style={{ background: bg, color: intensity > 0.5 ? "white" : undefined }}
                          title={`${label} ${h}h: ${fmtBRL(cell.revenue)} (${cell.orders} pedidos)`}
                        >
                          {cell.orders > 0 ? cell.orders : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-2">Número = pedidos. Cor = faturamento (mais escuro = mais vendas).</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
