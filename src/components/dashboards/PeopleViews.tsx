import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, UtensilsCrossed, DollarSign, Bike, Phone, Calendar, Trophy, Clock,
} from "lucide-react";
import {
  useWaiterRanking, useTableMetrics, useServiceCharge, useTopCustomers,
  useDeliveryTime,
} from "@/hooks/useSaiposDashboards";

interface Props {
  start: Date;
  end: Date;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRL2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");

function fmtMinutes(m: number): string {
  if (m < 1) return `${Math.round(m * 60)}s`;
  if (m < 60) return `${m.toFixed(0)}min`;
  return `${Math.floor(m / 60)}h${String(Math.floor(m % 60)).padStart(2, "0")}`;
}

function daysSince(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// -----------------------------------------------------
// Waiter ranking
// -----------------------------------------------------
export function WaiterRanking({ start, end }: Props) {
  const { data, isLoading } = useWaiterRanking(start, end, 30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Faturamento por garçom (Salão)
        </CardTitle>
        <CardDescription>
          Ranking de garçons por faturamento. ID do garçom no Saipos — mapeie no painel da Saipos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados de garçom no período</p>
        ) : (
          <div className="space-y-1">
            {data.map((w, i) => {
              const max = data[0].total_revenue;
              const pct = max > 0 ? (w.total_revenue / max) * 100 : 0;
              return (
                <div key={w.id_store_waiter} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-border/40 last:border-0">
                  <div className="col-span-1 text-xs text-muted-foreground tabular-nums">#{i + 1}</div>
                  <div className="col-span-3 font-medium text-sm">Garçom #{w.id_store_waiter}</div>
                  <div className="col-span-2 text-xs text-muted-foreground tabular-nums">{fmtInt(w.total_orders)} mesas</div>
                  <div className="col-span-2 text-xs text-muted-foreground tabular-nums">{fmtInt(w.total_items)} itens</div>
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-sm font-medium tabular-nums w-24 text-right">{fmtBRL(w.total_revenue)}</div>
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

// -----------------------------------------------------
// Table metrics
// -----------------------------------------------------
export function TableMetricsCards({ start, end }: Props) {
  const { data, isLoading } = useTableMetrics(start, end);

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiSmall icon={<UtensilsCrossed className="w-4 h-4" />} label="Mesas atendidas" value={fmtInt(data.total_table_orders)} />
      <KpiSmall icon={<Users className="w-4 h-4" />} label="Clientes (total)" value={fmtInt(data.total_customers)} sub={data.avg_customers_per_table != null ? `~${data.avg_customers_per_table.toFixed(1)} por mesa` : ""} />
      <KpiSmall icon={<DollarSign className="w-4 h-4" />} label="Ticket médio mesa" value={data.avg_table_revenue != null ? fmtBRL(data.avg_table_revenue) : "—"} />
      <KpiSmall icon={<Clock className="w-4 h-4" />} label="Tempo médio de mesa" value={data.avg_minutes_open != null ? fmtMinutes(data.avg_minutes_open) : "—"} />
    </div>
  );
}

// -----------------------------------------------------
// Service charge
// -----------------------------------------------------
export function ServiceChargeCard({ start, end }: Props) {
  const { data, isLoading } = useServiceCharge(start, end);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.total_orders_with_charge === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4">Nenhuma mesa com taxa de serviço configurada no período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxa de serviço</CardTitle>
        <CardDescription>
          Estimativa do quanto da taxa de serviço foi efetivamente paga vs recusada (com base na diferença entre cobrado e total da venda).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiSmall icon={<UtensilsCrossed className="w-4 h-4" />} label="Mesas com taxa" value={fmtInt(data.total_orders_with_charge)} />
          <KpiSmall icon={<DollarSign className="w-4 h-4" />} label="Total cobrado" value={fmtBRL(data.total_charged)} />
          <KpiSmall icon={<DollarSign className="w-4 h-4" />} label="Total pago (estimado)" value={fmtBRL(data.total_paid_estimated)} />
          <KpiSmall
            icon={<DollarSign className="w-4 h-4" />}
            label="Recusado (estimado)"
            value={fmtBRL(data.total_refused_estimated)}
            sub={`${data.refused_pct.toFixed(1)}%`}
            tone={data.refused_pct > 30 ? "warning" : "default"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------
// Delivery time
// -----------------------------------------------------
export function DeliveryTimeCard({ start, end }: Props) {
  const { data, isLoading } = useDeliveryTime(start, end);

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!data || data.total_delivery_orders === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bike className="w-5 h-5" /> Tempo médio de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4">Sem entregas no período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Bike className="w-5 h-5" /> Tempo médio de entrega</CardTitle>
        <CardDescription>Soma das durações dos status — do pedido criado até o último status registrado</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiSmall icon={<Bike className="w-4 h-4" />} label="Entregas analisadas" value={fmtInt(data.total_delivery_orders)} />
          <KpiSmall icon={<Clock className="w-4 h-4" />} label="Mediana" value={fmtMinutes(data.median_minutes)} />
          <KpiSmall icon={<Clock className="w-4 h-4" />} label="Média" value={fmtMinutes(data.avg_minutes)} />
          <KpiSmall
            icon={<Clock className="w-4 h-4" />}
            label="P90 (10% piores)"
            value={fmtMinutes(data.p90_minutes)}
            tone="warning"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------
// Top customers
// -----------------------------------------------------
export function TopCustomers({ start, end }: Props) {
  const { data, isLoading } = useTopCustomers(start, end, 30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Users className="w-5 h-5" /> Top clientes do período</CardTitle>
        <CardDescription>30 clientes que mais gastaram. Inclui última compra e dias inativos.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem clientes identificados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead className="text-right">Total gasto</TableHead>
                  <TableHead>Última compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c, i) => {
                  const days = daysSince(c.last_order_date);
                  return (
                    <TableRow key={c.customer_id_customer}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{c.customer_name || "(sem nome)"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.customer_phone ? (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.customer_phone}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{c.total_orders}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtBRL2(c.avg_ticket)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtBRL(c.total_revenue)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{new Date(c.last_order_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                          <Badge variant={days > 30 ? "destructive" : days > 14 ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                            {days === 0 ? "hoje" : `há ${days}d`}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------
// Small KPI helper
// -----------------------------------------------------
function KpiSmall({ icon, label, value, sub, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}<span>{label}</span></div>
        <p className={`text-xl font-bold tabular-nums ${tone === "warning" ? "text-amber-600" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
