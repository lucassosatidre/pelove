import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Users, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/lib/text";
import {
  useStrategicMap,
  getComputedStatus,
  STATUS_CONFIG,
  type Action,
  type Pillar,
} from "@/hooks/useStrategicData";

type FlatAction = Action & {
  pillar_id: string;
  pillar_name: string;
  pillar_number: number;
  obstacle_code: string;
  obstacle_description: string | null;
  responsibles: string[];
  computed_status: string;
};

type DateBucket = "all" | "overdue" | "this_week" | "next_7" | "next_30" | "no_date";

const DATE_BUCKET_LABEL: Record<DateBucket, string> = {
  all: "Todos os prazos",
  overdue: "Atrasadas",
  this_week: "Esta semana",
  next_7: "Próximos 7 dias",
  next_30: "Próximos 30 dias",
  no_date: "Sem prazo",
};

// No calendário queremos mostrar o ENTREGÁVEL (deliverable) em vez da Ação,
// porque é o resultado palpável que cada pessoa tem que produzir.
// Se a ação ainda não tem entregável preenchido, cai pra description como fallback.
function displayText(a: FlatAction): string {
  return (a.deliverable && a.deliverable.trim()) ? a.deliverable : a.description;
}

function flatten(pillars: Pillar[]): FlatAction[] {
  const out: FlatAction[] = [];
  for (const p of pillars) {
    for (const o of p.obstacles) {
      for (const a of o.actions) {
        const responsibles = (a.responsible ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        out.push({
          ...a,
          description: stripHtml(a.description),
          expected_result: a.expected_result ? stripHtml(a.expected_result) : null,
          deliverable: a.deliverable ? stripHtml(a.deliverable) : null,
          pillar_id: p.id,
          pillar_name: stripHtml(p.name),
          pillar_number: p.number,
          obstacle_code: stripHtml(o.code),
          obstacle_description: o.description ? stripHtml(o.description) : null,
          responsibles,
          computed_status: getComputedStatus(a),
        });
      }
    }
  }
  return out;
}

function todayISO() {
  return new Date().toISOString().substring(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

function endOfWeekISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + daysUntilSunday);
  return d.toISOString().substring(0, 10);
}

function fmtBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function applyFilters(
  actions: FlatAction[],
  q: {
    status: string[];
    bucket: DateBucket;
    pillar: string;
    person: string;
    search: string;
  },
): FlatAction[] {
  const t = todayISO();
  const eow = endOfWeekISO();
  const in7 = addDays(t, 7);
  const in30 = addDays(t, 30);

  return actions.filter((a) => {
    if (q.status.length > 0 && !q.status.includes(a.computed_status)) return false;
    if (q.pillar !== "all" && a.pillar_id !== q.pillar) return false;
    if (q.person !== "all" && !a.responsibles.includes(q.person)) return false;

    if (q.search.trim()) {
      const needle = q.search.trim().toLowerCase();
      const hay = [
        a.description,
        a.expected_result ?? "",
        a.deliverable ?? "",
        a.obstacle_description ?? "",
        a.pillar_name,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }

    switch (q.bucket) {
      case "all":
        return true;
      case "overdue":
        return a.computed_status === "atrasado";
      case "this_week":
        return !!a.deadline && a.deadline >= t && a.deadline <= eow;
      case "next_7":
        return !!a.deadline && a.deadline >= t && a.deadline <= in7;
      case "next_30":
        return !!a.deadline && a.deadline >= t && a.deadline <= in30;
      case "no_date":
        return !a.deadline;
      default:
        return true;
    }
  });
}

function StatusPill({ value }: { value: string }) {
  const cfg = STATUS_CONFIG[value] ?? { label: value, colorClass: "bg-muted text-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        cfg.colorClass,
      )}
    >
      {cfg.label}
    </span>
  );
}

function ActionLineItem({ a }: { a: FlatAction }) {
  const isOverdue = a.computed_status === "atrasado";
  const isScheduled = a.status === "agendado";
  return (
    <div className="border border-border rounded-md p-2 bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-xs font-medium leading-snug flex-1 min-w-0">{displayText(a)}</div>
        <StatusPill value={a.computed_status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="font-medium text-foreground/70">{a.pillar_number}.</span>
          {a.pillar_name}
        </span>
        <span>·</span>
        <span>{a.obstacle_code}</span>
        {a.responsibles.length > 0 && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {a.responsibles.join(", ")}
            </span>
          </>
        )}
        {isScheduled && a.start_date && (
          <>
            <span>·</span>
            <span>Início {fmtBR(a.start_date)}</span>
          </>
        )}
        {a.deadline && (
          <>
            <span>·</span>
            <span className={cn(isOverdue && "text-destructive font-medium")}>
              Prazo {fmtBR(a.deadline)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "danger" | "warning" | "success" | "info" | "neutral";
  hint?: string;
}) {
  const tones: Record<typeof tone, string> = {
    danger: "text-destructive",
    warning: "text-amber-600",
    success: "text-emerald-600",
    info: "text-blue-600",
    neutral: "text-foreground",
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Icon className={cn("h-3.5 w-3.5", tones[tone])} />
          {label}
        </div>
        <div className={cn("text-2xl font-bold leading-none", tones[tone])}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function PersonCard({ name, actions }: { name: string; actions: FlatAction[] }) {
  const counts = useMemo(() => {
    const c = { atrasado: 0, em_andamento: 0, agendado: 0, nao_iniciado: 0, concluido: 0 } as Record<string, number>;
    for (const a of actions) {
      c[a.computed_status] = (c[a.computed_status] ?? 0) + 1;
    }
    return c;
  }, [actions]);

  const next = useMemo(() => {
    const t = todayISO();
    return actions
      .filter((a) => a.deadline && a.deadline >= t && a.computed_status !== "concluido")
      .sort((x, y) => (x.deadline ?? "").localeCompare(y.deadline ?? ""))[0];
  }, [actions]);

  const overload = actions.filter((a) => a.computed_status === "em_andamento").length >= 4;

  return (
    <Card className={cn(overload && "border-amber-500/50")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
              {name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            {name}
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {actions.length} {actions.length === 1 ? "ação" : "ações"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {counts.atrasado > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[10px] px-2 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> {counts.atrasado} atrasada{counts.atrasado > 1 ? "s" : ""}
            </span>
          )}
          {counts.em_andamento > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-700 text-[10px] px-2 py-0.5">
              <Clock3 className="h-2.5 w-2.5" /> {counts.em_andamento} em andamento
            </span>
          )}
          {counts.agendado > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 text-purple-700 text-[10px] px-2 py-0.5">
              <CalendarClock className="h-2.5 w-2.5" /> {counts.agendado} agendada{counts.agendado > 1 ? "s" : ""}
            </span>
          )}
          {counts.concluido > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] px-2 py-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" /> {counts.concluido} concluída{counts.concluido > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {next && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Próxima entrega: <span className="font-medium text-foreground">{fmtBR(next.deadline)}</span> — {displayText(next)}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {actions
          .slice()
          .sort((a, b) => {
            // overdue first, then by deadline asc
            const sa = a.computed_status === "atrasado" ? 0 : a.computed_status === "concluido" ? 2 : 1;
            const sb = b.computed_status === "atrasado" ? 0 : b.computed_status === "concluido" ? 2 : 1;
            if (sa !== sb) return sa - sb;
            return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
          })
          .map((a) => (
            <ActionLineItem key={a.id} a={a} />
          ))}
      </CardContent>
    </Card>
  );
}

function MonthCalendar({ actions }: { actions: FlatAction[] }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const grid: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < startDow; i++) grid.push(null);
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    grid.push({ iso, day: d });
  }
  while (grid.length % 7 !== 0) grid.push(null);

  const byDay = useMemo(() => {
    const m = new Map<string, FlatAction[]>();
    for (const a of actions) {
      if (!a.deadline) continue;
      if (!m.has(a.deadline)) m.set(a.deadline, []);
      m.get(a.deadline)!.push(a);
    }
    return m;
  }, [actions]);

  const t = todayISO();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm capitalize">{monthLabel}</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ‹
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date();
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            ›
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[80px]" />;
            const items = byDay.get(cell.iso) ?? [];
            const isToday = cell.iso === t;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[80px] border border-border rounded p-1 text-[10px]",
                  isToday && "border-primary/60 bg-primary/5",
                )}
              >
                <div className={cn("font-medium mb-1", isToday && "text-primary")}>{cell.day}</div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5",
                        a.computed_status === "atrasado" && "bg-destructive/15 text-destructive",
                        a.computed_status === "concluido" && "bg-emerald-500/15 text-emerald-700",
                        a.computed_status === "em_andamento" && "bg-blue-500/15 text-blue-700",
                        a.computed_status === "agendado" && "bg-purple-500/15 text-purple-700",
                        a.computed_status === "nao_iniciado" && "bg-muted text-muted-foreground",
                      )}
                      title={`${displayText(a)} — ${a.responsibles.join(", ") || "sem responsável"}`}
                    >
                      {displayText(a)}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-muted-foreground text-[9px]">+{items.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Timeline({ actions }: { actions: FlatAction[] }) {
  // 30-day horizontal timeline of upcoming + overdue actions
  const t = todayISO();
  const items = actions
    .filter((a) => a.deadline && a.computed_status !== "concluido")
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nada agendado ou pendente. Bom respiro.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Próximas entregas (atrasadas + futuras)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((a) => {
          const isOverdue = a.computed_status === "atrasado";
          const dl = a.deadline!;
          const daysFromToday = Math.round(
            (new Date(dl + "T00:00:00").getTime() - new Date(t + "T00:00:00").getTime()) / 86400000,
          );
          const relLabel =
            daysFromToday === 0 ? "Hoje" :
            daysFromToday === 1 ? "Amanhã" :
            daysFromToday < 0 ? `${Math.abs(daysFromToday)}d atrás` :
            `em ${daysFromToday}d`;
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-2 border-l-2 pl-3 py-1.5 rounded-r",
                isOverdue ? "border-destructive bg-destructive/5" : "border-border",
              )}
            >
              <div className="w-20 shrink-0 text-[11px]">
                <div className={cn("font-medium", isOverdue && "text-destructive")}>{fmtBR(dl)}</div>
                <div className="text-[9px] text-muted-foreground">{relLabel}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{displayText(a)}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {a.pillar_name} · {a.responsibles.join(", ") || "sem responsável"}
                </div>
              </div>
              <StatusPill value={a.computed_status} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function CalendarioAcompanhamento() {
  const { data: pillars, isLoading } = useStrategicMap();

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [bucket, setBucket] = useState<DateBucket>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allActions = useMemo(() => (pillars ? flatten(pillars) : []), [pillars]);

  const allPeople = useMemo(() => {
    const s = new Set<string>();
    for (const a of allActions) for (const p of a.responsibles) s.add(p);
    return Array.from(s).sort();
  }, [allActions]);

  const filtered = useMemo(
    () => applyFilters(allActions, { status: statusFilter, bucket, pillar: pillarFilter, person: personFilter, search }),
    [allActions, statusFilter, bucket, pillarFilter, personFilter, search],
  );

  // Summary uses unfiltered (it's the global health snapshot)
  const summary = useMemo(() => {
    const s = { atrasadas: 0, em_andamento: 0, esta_semana: 0, agendadas: 0, concluidas: 0, sem_responsavel: 0 };
    const t = todayISO();
    const eow = endOfWeekISO();
    for (const a of allActions) {
      if (a.computed_status === "atrasado") s.atrasadas++;
      if (a.computed_status === "em_andamento") s.em_andamento++;
      if (a.computed_status === "agendado") s.agendadas++;
      if (a.computed_status === "concluido") s.concluidas++;
      if (a.deadline && a.deadline >= t && a.deadline <= eow && a.computed_status !== "concluido") s.esta_semana++;
      if (a.responsibles.length === 0) s.sem_responsavel++;
    }
    return s;
  }, [allActions]);

  const byPerson = useMemo(() => {
    const m = new Map<string, FlatAction[]>();
    const unassigned: FlatAction[] = [];
    for (const a of filtered) {
      if (a.responsibles.length === 0) {
        unassigned.push(a);
        continue;
      }
      for (const p of a.responsibles) {
        if (!m.has(p)) m.set(p, []);
        m.get(p)!.push(a);
      }
    }
    const arr = Array.from(m.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, list]) => ({ name, actions: list }));
    if (unassigned.length > 0) arr.push({ name: "Sem responsável", actions: unassigned });
    return arr;
  }, [filtered]);

  const toggleStatus = (s: string) => {
    setStatusFilter((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setBucket("all");
    setPillarFilter("all");
    setPersonFilter("all");
    setSearch("");
  };

  const hasActiveFilter =
    statusFilter.length > 0 || bucket !== "all" || pillarFilter !== "all" || personFilter !== "all" || search.trim() !== "";

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={AlertTriangle} label="Atrasadas" value={summary.atrasadas} tone="danger" hint="prazo vencido" />
        <SummaryCard icon={CalendarClock} label="Esta semana" value={summary.esta_semana} tone="warning" hint="até domingo" />
        <SummaryCard icon={Clock3} label="Em andamento" value={summary.em_andamento} tone="info" />
        <SummaryCard icon={CalendarClock} label="Agendadas" value={summary.agendadas} tone="info" />
        <SummaryCard icon={CheckCircle2} label="Concluídas" value={summary.concluidas} tone="success" />
        <SummaryCard icon={Users} label="Sem responsável" value={summary.sem_responsavel} tone="neutral" hint="ações órfãs" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <Filter className="h-3.5 w-3.5" /> Filtrar:
            </div>

            <Select value={bucket} onValueChange={(v) => setBucket(v as DateBucket)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_BUCKET_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Pilar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os pilares</SelectItem>
                {pillars?.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.number}. {stripHtml(p.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as pessoas</SelectItem>
                {allPeople.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar texto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[200px] text-xs"
            />

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
            {Object.entries(STATUS_CONFIG).map(([k, cfg]) => {
              const active = statusFilter.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => toggleStatus(k)}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all",
                    active ? cfg.colorClass : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
            <span className="text-[10px] text-muted-foreground ml-2">
              {filtered.length} de {allActions.length} ações
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Visões */}
      <Tabs defaultValue="pessoas" className="w-full">
        <TabsList>
          <TabsTrigger value="pessoas" className="text-xs">Por pessoa</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
          <TabsTrigger value="calendario" className="text-xs">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoas" className="mt-3">
          {byPerson.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma ação corresponde aos filtros.
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 pr-3">
                {byPerson.map((p) => (
                  <PersonCard key={p.name} name={p.name} actions={p.actions} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3">
          <Timeline actions={filtered} />
        </TabsContent>

        <TabsContent value="calendario" className="mt-3">
          <MonthCalendar actions={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
