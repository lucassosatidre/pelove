import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ShoppingBag, DollarSign, Receipt } from "lucide-react";
import { useSalesTotals, type SaleType } from "@/hooks/useSaiposDashboards";

interface Props {
  start: Date;
  end: Date;
  compareStart: Date;
  compareEnd: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");

function trend(current: number, previous: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { pct: current > 0 ? 100 : 0, direction: current > 0 ? "up" : "flat" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct >= 0 ? "up" : "down" };
}

function TrendBadge({ pct, direction, inverse = false }: { pct: number; direction: "up" | "down" | "flat"; inverse?: boolean }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const isGood = inverse ? direction === "down" : direction === "up";
  const color = direction === "flat" ? "text-muted-foreground" : isGood ? "text-emerald-500" : "text-destructive";
  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      <span>{pct === 0 ? "0%" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}</span>
    </div>
  );
}

export function KpiCards({ start, end, compareStart, compareEnd, saleTypes }: Props) {
  const current = useSalesTotals(start, end, saleTypes);
  const previous = useSalesTotals(compareStart, compareEnd, saleTypes);

  if (current.isLoading || previous.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const c = current.data ?? { total_revenue: 0, total_orders: 0, avg_ticket: 0 };
  const p = previous.data ?? { total_revenue: 0, total_orders: 0, avg_ticket: 0 };

  const tRevenue = trend(c.total_revenue, p.total_revenue);
  const tOrders = trend(c.total_orders, p.total_orders);
  const tTicket = trend(c.avg_ticket, p.avg_ticket);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Faturamento"
        value={fmtBRL(c.total_revenue)}
        compareValue={fmtBRL(p.total_revenue)}
        trend={tRevenue}
      />
      <KpiCard
        icon={<ShoppingBag className="w-5 h-5" />}
        label="Pedidos"
        value={fmtInt(c.total_orders)}
        compareValue={fmtInt(p.total_orders)}
        trend={tOrders}
      />
      <KpiCard
        icon={<Receipt className="w-5 h-5" />}
        label="Ticket médio"
        value={fmtBRL(c.avg_ticket)}
        compareValue={fmtBRL(p.avg_ticket)}
        trend={tTicket}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, compareValue, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compareValue: string;
  trend: { pct: number; direction: "up" | "down" | "flat" };
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {icon}
            <span>{label}</span>
          </div>
          <TrendBadge {...trend} />
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">vs. {compareValue}</p>
      </CardContent>
    </Card>
  );
}
