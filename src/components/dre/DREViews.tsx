import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Receipt, Wallet } from "lucide-react";
import {
  useDRESummary, useDRERevenueByChannel, useDREExpensesByCategory,
  useDREMonthlyEvolution,
} from "@/hooks/useDRE";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtBRLshort = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

interface RangeProps {
  start: Date;
  end: Date;
}

// =====================================================
// 1. KPI Cards: Faturamento, Despesas, Resultado, Margem
// =====================================================
export function DREKpiCards({ start, end }: RangeProps) {
  const summary = useDRESummary(start, end);

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const s = summary.data ?? {
    gross_revenue: 0, net_sales_revenue: 0, total_expenses: 0,
    net_result: 0, total_orders: 0, avg_ticket: 0,
    other_income: 0, total_discount: 0, total_increase: 0,
    delivery_fee_passthrough: 0, service_charge_passthrough: 0,
  };

  const margin = s.net_sales_revenue > 0 ? (s.net_result / s.net_sales_revenue) * 100 : 0;
  const positiveResult = s.net_result >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Faturamento bruto"
        value={fmtBRL(s.gross_revenue)}
        sub={`${fmtInt(s.total_orders)} pedidos · tkt ${fmtBRL(s.avg_ticket)}`}
      />
      <KpiCard
        icon={<Receipt className="w-5 h-5" />}
        label="Receita líquida"
        value={fmtBRL(s.net_sales_revenue)}
        sub={`Bruto − repasses (${fmtBRL(s.delivery_fee_passthrough + s.service_charge_passthrough)})`}
      />
      <KpiCard
        icon={<Wallet className="w-5 h-5" />}
        label="Despesas"
        value={fmtBRL(s.total_expenses)}
        sub={s.other_income > 0 ? `+ outras receitas: ${fmtBRL(s.other_income)}` : "do módulo financeiro"}
      />
      <KpiCard
        icon={positiveResult ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        label="Resultado"
        value={fmtBRL(s.net_result)}
        sub={`Margem ${fmtPct(margin)}`}
        accent={positiveResult ? "good" : "bad"}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "good" | "bad";
}) {
  const valueClass =
    accent === "good" ? "text-emerald-500" :
    accent === "bad" ? "text-destructive" :
    "text-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          {icon}
          <span>{label}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// =====================================================
// 2. DRE em formato cascata (estrutura clássica)
// =====================================================
export function DRECascade({ start, end }: RangeProps) {
  const summary = useDRESummary(start, end);

  if (summary.isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Demonstrativo de resultado</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-80 w-full" /></CardContent>
      </Card>
    );
  }

  const s = summary.data;
  if (!s) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Demonstrativo de resultado</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p></CardContent>
      </Card>
    );
  }

  const margin = s.net_sales_revenue > 0 ? (s.net_result / s.net_sales_revenue) * 100 : 0;

  const rows: Array<{
    label: string;
    value: number;
    bold?: boolean;
    indent?: boolean;
    sign?: "+" | "-" | "=";
    note?: string;
  }> = [
    { label: "(+) Faturamento bruto (vendas)", value: s.gross_revenue, bold: true },
    { label: "Descontos concedidos", value: -s.total_discount, indent: true, sign: "-", note: "já deduzidos do bruto" },
    { label: "Acréscimos cobrados", value: s.total_increase, indent: true, sign: "+", note: "já incluídos no bruto" },
    { label: "(−) Taxa de entrega (repasse entregador)", value: -s.delivery_fee_passthrough, sign: "-" },
    { label: "(−) Taxa de serviço (repasse garçom)", value: -s.service_charge_passthrough, sign: "-" },
    { label: "(=) Receita líquida operacional", value: s.net_sales_revenue, bold: true, sign: "=" },
    { label: "(+) Outras receitas (mov. financeiras)", value: s.other_income, sign: "+" },
    { label: "(−) Despesas operacionais", value: -s.total_expenses, sign: "-" },
    { label: "(=) Resultado do período", value: s.net_result, bold: true, sign: "=" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Demonstrativo de resultado</CardTitle>
        <Badge variant={s.net_result >= 0 ? "default" : "destructive"} className="font-mono">
          margem {fmtPct(margin)}
        </Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {rows.map((r, i) => {
              const isResult = r.sign === "=" && r.label.includes("Resultado");
              const valueColor =
                isResult ? (r.value >= 0 ? "text-emerald-500" : "text-destructive") :
                r.value < 0 ? "text-destructive/80" :
                r.value > 0 && r.sign === "+" ? "text-emerald-500/80" :
                "text-foreground";
              return (
                <TableRow key={i} className={r.sign === "=" ? "bg-muted/40" : ""}>
                  <TableCell className={`${r.bold ? "font-semibold" : ""} ${r.indent ? "pl-8 text-muted-foreground text-xs" : ""}`}>
                    {r.label}
                    {r.note && <span className="ml-2 text-xs text-muted-foreground italic">({r.note})</span>}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${r.bold ? "font-bold" : ""} ${valueColor}`}>
                    {fmtBRL(r.value)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =====================================================
// 3. Receita por canal (entrega/balcão/salão/iFood)
// =====================================================
export function DRERevenueByChannel({ start, end }: RangeProps) {
  const data = useDRERevenueByChannel(start, end);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Receita por canal</CardTitle></CardHeader>
      <CardContent>
        {data.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data.data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">% do total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell className="font-medium">{row.channel}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(row.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct_of_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// 4. Despesas por categoria
// =====================================================
export function DREExpensesByCategory({ start, end }: RangeProps) {
  const data = useDREExpensesByCategory(start, end);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
      <CardContent>
        {data.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data.data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma despesa registrada no período. Verifique se o módulo financeiro do Saipos está sendo sincronizado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Lançamentos</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">% do total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row) => (
                <TableRow key={row.category}>
                  <TableCell className="font-medium">{row.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.txn_count)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(row.paid_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-500/90">{fmtBRL(row.unpaid_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(row.amount_total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct_of_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// 5. Evolução mensal (gráfico)
// =====================================================
export function DREMonthlyChart({ start, end }: RangeProps) {
  const series = useDREMonthlyEvolution(start, end);

  const chartData = (series.data ?? []).map((p) => ({
    label: new Date(p.month_bucket + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    revenue: p.revenue,
    expenses: p.expenses,
    result: p.result,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
      <CardContent>
        {series.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip formatter={(v: any) => fmtBRLshort(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Receita líquida" fill="hsl(var(--primary))" />
                <Bar dataKey="expenses" name="Despesas" fill="hsl(var(--destructive) / 0.7)" />
                <Line type="monotone" dataKey="result" name="Resultado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
