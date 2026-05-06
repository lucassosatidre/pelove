import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Receipt, Wallet } from "lucide-react";
import {
  useDRESummary, useDRERevenueByChannel, useDREExpensesByGroup,
  useDREMonthlyEvolution, DRE_GROUP_LABELS, type DREGroup,
} from "@/hooks/useDRE";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtBRLshort = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

interface RangeProps {
  start: Date;
  end: Date;
}

// =====================================================
// 1. KPI Cards (Bruta / Líquida / Lucro Operacional / Lucro Líquido)
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

  const s = summary.data;
  if (!s) return null;

  const operatingMargin = s.gross_revenue > 0 ? (s.operating_profit / s.gross_revenue) * 100 : 0;
  const netMargin = s.gross_revenue > 0 ? (s.net_profit / s.gross_revenue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Receita Operacional Bruta"
        value={fmtBRL(s.gross_revenue)}
        sub={`${fmtInt(s.total_orders)} pedidos · tkt ${fmtBRL(s.avg_ticket)}`}
      />
      <KpiCard
        icon={<Receipt className="w-5 h-5" />}
        label="Receita Líquida"
        value={fmtBRL(s.net_revenue)}
        sub={`Bruta − impostos (${fmtBRL(s.total_taxes)})`}
      />
      <KpiCard
        icon={<Wallet className="w-5 h-5" />}
        label="Lucro Operacional"
        value={fmtBRL(s.operating_profit)}
        sub={`Margem operacional ${fmtPct(operatingMargin)}`}
        accent={s.operating_profit >= 0 ? "good" : "bad"}
      />
      <KpiCard
        icon={s.net_profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        label="Lucro Líquido"
        value={fmtBRL(s.net_profit)}
        sub={`Margem líquida ${fmtPct(netMargin)}`}
        accent={s.net_profit >= 0 ? "good" : "bad"}
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
// 2. DRE em cascata (estrutura clássica Saipos-aligned)
// =====================================================
export function DRECascade({ start, end }: RangeProps) {
  const summary = useDRESummary(start, end);

  if (summary.isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Demonstrativo de resultado</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
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

  const pctNet = (v: number) => s.net_revenue > 0 ? (v / s.net_revenue) * 100 : 0;
  const netMargin = s.gross_revenue > 0 ? (s.net_profit / s.gross_revenue) * 100 : 0;

  const rows: Array<{
    label: string;
    value: number;
    pctOfNet?: number;
    role?: "section" | "subtotal" | "total";
  }> = [
    { label: "(+) Receita Operacional Bruta", value: s.gross_revenue, role: "section" },
    { label: "(−) Impostos", value: -s.total_taxes },
    { label: "(=) Receita Líquida", value: s.net_revenue, role: "subtotal" },
    { label: "(−) Custo das Mercadorias Vendidas (CMV)", value: -s.total_cogs },
    { label: "(−) Custo com Vendas", value: -s.total_sales_cost },
    { label: "(=) Lucro Operacional Bruto", value: s.gross_operating_profit, role: "subtotal" },
    { label: "(−) Despesas Administrativas", value: -s.total_admin },
    { label: "(−) Despesas Financeiras", value: -s.total_financial_expenses },
    { label: "(=) Lucro Operacional", value: s.operating_profit, role: "subtotal" },
    { label: "(+) Receita não Operacional", value: s.non_operational_income },
    { label: "(=) Lucro antes do IR", value: s.profit_before_tax, role: "subtotal" },
    { label: "(−) IR", value: -s.income_tax },
    { label: "(=) Lucro antes do Pró-Labore", value: s.profit_before_prolabore, role: "subtotal" },
    { label: "(−) Pró-Labore", value: -s.prolabore },
    { label: "(=) Lucro Líquido do Exercício", value: s.net_profit, role: "total" },
  ].map((r) => ({ ...r, pctOfNet: pctNet(r.value) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Demonstrativo de Resultado</CardTitle>
        <Badge variant={s.net_profit >= 0 ? "default" : "destructive"} className="font-mono">
          margem líquida {fmtPct(netMargin)}
        </Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3">Linha</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right w-24">% RL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const isTotal = r.role === "total";
              const isSubtotal = r.role === "subtotal";
              const isSection = r.role === "section";
              const rowClass =
                isTotal ? "bg-primary/5 border-t-2 border-primary/30" :
                isSubtotal ? "bg-muted/40 font-medium" :
                isSection ? "font-medium" : "";
              const valueColor =
                isTotal ? (r.value >= 0 ? "text-emerald-500" : "text-destructive") :
                r.value < 0 ? "text-destructive/80" :
                "text-foreground";
              return (
                <TableRow key={i} className={rowClass}>
                  <TableCell className={isTotal ? "font-bold" : ""}>{r.label}</TableCell>
                  <TableCell className={`text-right tabular-nums ${valueColor} ${isTotal ? "font-bold" : ""}`}>
                    {fmtBRL(r.value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {fmtPct(r.pctOfNet ?? 0)}
                  </TableCell>
                </TableRow>
              );
            })}
            {s.excluded_amount > 0 && (
              <TableRow className="border-t border-dashed">
                <TableCell className="text-xs text-muted-foreground italic">
                  Excluído do DRE (sangria, frente de caixa, transferências)
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground italic">
                  {fmtBRL(s.excluded_amount)}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-4 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">⚠️ Diferença esperada vs. DRE Gerencial do Saipos</p>
          <p>
            <strong>Custo com Vendas</strong> aqui só inclui categorias do módulo financeiro
            (Motoboy, Marketing, Gasolina, etc). O DRE do Saipos calcula adicionalmente comissão de
            marketplace (iFood/Brendi), taxas de cartão e logística terceirizada a partir das próprias
            vendas — esses valores não estão lançados em <code className="text-[10px] bg-muted px-1 rounded">saipos_financial</code>.
          </p>
          <p>
            <strong>CMV</strong> usa apenas a categoria "Matéria Prima"; o Saipos quebra em Frios/Secos/Bebidas
            via subcategoria interna que não vem na API.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// 3. Receita por canal (mantida)
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
// 4. Despesas agrupadas por grupo DRE (com accordion expansível)
// =====================================================
const GROUP_ORDER: DREGroup[] = [
  "tax", "cogs", "sales_cost", "admin", "financial", "income_tax", "prolabore", "exclude",
];

export function DREExpensesByGroup({ start, end }: RangeProps) {
  const data = useDREExpensesByGroup(start, end);

  const grouped = useMemo(() => {
    const rows = data.data ?? [];
    const map = new Map<DREGroup, { total: number; rows: typeof rows }>();
    for (const r of rows) {
      const g = map.get(r.dre_group) ?? { total: 0, rows: [] };
      g.total += r.amount_total;
      g.rows.push(r);
      map.set(r.dre_group, g);
    }
    return GROUP_ORDER
      .filter((g) => map.has(g))
      .map((g) => ({ group: g, ...map.get(g)! }));
  }, [data.data]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Despesas por grupo DRE</CardTitle></CardHeader>
      <CardContent>
        {data.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma despesa registrada no período.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {grouped.map(({ group, total, rows }) => (
              <AccordionItem key={group} value={group}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full items-center justify-between pr-4">
                    <span className="font-medium">{DRE_GROUP_LABELS[group]}</span>
                    <span className="tabular-nums font-semibold">{fmtBRL(total)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Lançamentos</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">A pagar</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% grupo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.category}>
                          <TableCell className="font-medium">{row.category}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(row.txn_count)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(row.paid_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-amber-500/90">{fmtBRL(row.unpaid_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(row.amount_total)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct_of_group)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
    net_revenue: p.net_revenue,
    expenses: p.total_expenses,
    operating_profit: p.operating_profit,
    net_profit: p.net_profit,
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
                <Bar dataKey="net_revenue" name="Receita líquida" fill="hsl(var(--primary))" />
                <Bar dataKey="expenses" name="Despesas totais" fill="hsl(var(--destructive) / 0.7)" />
                <Line type="monotone" dataKey="operating_profit" name="Lucro Operacional" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net_profit" name="Lucro Líquido" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
