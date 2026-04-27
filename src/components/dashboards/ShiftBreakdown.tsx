import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesByShift, useSalesByType, type SaleType, SALE_TYPE_LABELS } from "@/hooks/useSaiposDashboards";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const TYPE_COLORS: Record<number, string> = {
  1: "hsl(217 91% 60%)",   // delivery
  2: "hsl(142 71% 45%)",   // balcao
  3: "hsl(25 95% 53%)",    // salao
  4: "hsl(280 65% 60%)",   // ficha
};

export function ShiftBreakdown({ start, end, saleTypes }: Props) {
  const byShift = useSalesByShift(start, end, saleTypes);
  const byType = useSalesByType(start, end);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas por turno</CardTitle>
        </CardHeader>
        <CardContent>
          {byShift.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !byShift.data || byShift.data.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Sem dados</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byShift.data} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <YAxis type="category" dataKey="shift_label" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas por canal</CardTitle>
        </CardHeader>
        <CardContent>
          {byType.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !byType.data || byType.data.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Sem dados</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType.data} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <YAxis type="category" dataKey="type_label" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any, _n, p: any) => [fmtBRL(Number(v)), SALE_TYPE_LABELS[p.payload.id_sale_type as SaleType] ?? "Outro"]} />
                  <Bar dataKey="revenue">
                    {byType.data.map((d) => (
                      <Cell key={d.id_sale_type} fill={TYPE_COLORS[d.id_sale_type] ?? "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
