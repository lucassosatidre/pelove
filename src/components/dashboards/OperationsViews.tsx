import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, AlertTriangle, XCircle, TrendingDown } from "lucide-react";
import {
  useStatusAvgTimes, useSlowestOrders, useCancellations, type SaleType,
} from "@/hooks/useSaiposDashboards";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";

interface Props {
  start: Date;
  end: Date;
  saleTypes: SaleType[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`;
  return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}`;
}

// -----------------------------------------------------
// Status average times
// -----------------------------------------------------
export function StatusAvgTimes({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useStatusAvgTimes(start, end, saleTypes);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-5 h-5" /> Tempo médio em cada status
        </CardTitle>
        <CardDescription>
          Média, mediana e percentil 90% (top 10% mais demorados) — bom pra ver o gargalo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem histórico de status no período</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Eventos</TableHead>
                <TableHead className="text-right">Mediana</TableHead>
                <TableHead className="text-right">Média</TableHead>
                <TableHead className="text-right">P90</TableHead>
                <TableHead className="text-right w-32">Distribuição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => {
                const max = data[0].avg_seconds;
                const pct = max > 0 ? (s.avg_seconds / max) * 100 : 0;
                return (
                  <TableRow key={s.status_label}>
                    <TableCell className="font-medium">{s.status_label}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{s.total_events.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDuration(s.median_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDuration(s.avg_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{fmtDuration(s.p90_seconds)}</TableCell>
                    <TableCell>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------
// Slowest orders
// -----------------------------------------------------
export function SlowestOrders({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useSlowestOrders(start, end, saleTypes, 30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> Pedidos mais demorados
        </CardTitle>
        <CardDescription>
          Top 30 pedidos com maior tempo total (criação → último status), incluindo o status onde mais ficou parado
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Tempo total</TableHead>
                  <TableHead>Onde travou</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id_sale}>
                    <TableCell className="font-mono text-xs">#{o.id_sale}</TableCell>
                    <TableCell className="text-xs">{new Date(o.shift_date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{o.partner_desc || o.type_label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{o.total_amount != null ? fmtBRL(o.total_amount) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtDuration(o.total_seconds)}</TableCell>
                    <TableCell className="text-xs">
                      {o.worst_status ? (
                        <span>
                          <span className="text-muted-foreground">{o.worst_status}</span>
                          {o.worst_status_seconds != null && (
                            <span className="text-amber-600 ml-1 tabular-nums">({fmtDuration(o.worst_status_seconds)})</span>
                          )}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------
// Cancellations
// -----------------------------------------------------
export function CancellationsBreakdown({ start, end, saleTypes }: Props) {
  const { data, isLoading } = useCancellations(start, end, saleTypes);

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4" /> Cancelamentos
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.total_cancellations.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4" /> Valor não-faturado
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmtBRL(data.total_cancellation_value)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Taxa de cancelamento</div>
            <p className="text-2xl font-bold tabular-nums">{data.cancellation_rate_pct.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancelamentos por motivo</CardTitle>
          </CardHeader>
          <CardContent>
            {data.by_reason.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem motivos registrados</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_reason} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--destructive) / 0.8)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancelamentos por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {data.by_day.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem cancelamentos no período</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.by_day} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => [name === "value" ? fmtBRL(Number(v)) : v, name === "value" ? "Valor" : "Qtd"]}
                      labelFormatter={(v) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR")}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
