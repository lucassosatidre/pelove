import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useSalesSeries, suggestedGranularity, type SaleType, type Granularity } from "@/hooks/useSaiposDashboards";
import { useState, useMemo } from "react";

interface Props {
  start: Date;
  end: Date;
  compareStart: Date;
  compareEnd: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtBucketShort = (iso: string, gran: Granularity) => {
  const d = new Date(iso + "T00:00:00");
  if (gran === "year") return String(d.getFullYear());
  if (gran === "month") return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  if (gran === "week") return `Sem ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function ComparativeChart({ start, end, compareStart, compareEnd, saleTypes }: Props) {
  const suggested = suggestedGranularity(start, end);
  const [granularity, setGranularity] = useState<Granularity>(suggested);

  const current = useSalesSeries(start, end, granularity, saleTypes);
  const previous = useSalesSeries(compareStart, compareEnd, granularity, saleTypes);

  // Align the two series by ordinal position (1st bucket vs 1st, 2nd vs 2nd, etc.)
  // so the comparison still makes sense even when dates don't match.
  const data = useMemo(() => {
    const a = current.data ?? [];
    const b = previous.data ?? [];
    const len = Math.max(a.length, b.length);
    return Array.from({ length: len }).map((_, i) => ({
      idx: i,
      label: a[i] ? fmtBucketShort(a[i].bucket, granularity) : (b[i] ? fmtBucketShort(b[i].bucket, granularity) : ""),
      atual_revenue: a[i]?.revenue ?? null,
      atual_orders: a[i]?.orders ?? null,
      anterior_revenue: b[i]?.revenue ?? null,
      anterior_orders: b[i]?.orders ?? null,
    }));
  }, [current.data, previous.data, granularity]);

  const isLoading = current.isLoading || previous.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Comparativo de vendas</CardTitle>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Por dia</SelectItem>
            <SelectItem value="week">Por semana</SelectItem>
            <SelectItem value="month">Por mês</SelectItem>
            <SelectItem value="year">Por ano</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  formatter={(v: any, name: any) => {
                    if (name === "atual_revenue" || name === "anterior_revenue") return fmtBRL(Number(v ?? 0));
                    return Number(v ?? 0).toLocaleString("pt-BR");
                  }}
                  labelFormatter={(label, payload) => {
                    const p = payload?.[0]?.payload;
                    return p ? p.label : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="anterior_revenue" name="Anterior" fill="hsl(var(--muted-foreground) / 0.4)" />
                <Bar dataKey="atual_revenue" name="Atual" fill="hsl(var(--primary))" />
                <Line type="monotone" dataKey="atual_orders" name="Pedidos atual" yAxisId={0} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
