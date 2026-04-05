import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVision, useStrategicMap, getComputedStatus, STATUS_CONFIG, AREA_OPTIONS, Action, Pillar, Obstacle } from "@/hooks/useStrategicData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Filter } from "lucide-react";
import { format } from "date-fns";

/* ── connector line helper ─────────────────────────── */
interface ConnectorProps {
  from: React.RefObject<HTMLDivElement | null>;
  to: React.RefObject<HTMLDivElement | null>;
  active?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function Connector({ from, to, active, containerRef }: ConnectorProps) {
  const [d, setD] = useState("");

  const calc = useCallback(() => {
    if (!from.current || !to.current || !containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const fRect = from.current.getBoundingClientRect();
    const tRect = to.current.getBoundingClientRect();
    const x1 = fRect.right - cRect.left;
    const y1 = fRect.top + fRect.height / 2 - cRect.top;
    const x2 = tRect.left - cRect.left;
    const y2 = tRect.top + tRect.height / 2 - cRect.top;
    const cx = (x1 + x2) / 2;
    setD(`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
  }, [from, to, containerRef]);

  useEffect(() => {
    calc();
    const ro = new ResizeObserver(calc);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("scroll", calc, true);
    return () => { ro.disconnect(); window.removeEventListener("scroll", calc, true); };
  }, [calc, containerRef]);

  if (!d) return null;
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={2}
      className={active ? "stroke-primary" : "stroke-border"}
      style={{ transition: "stroke 0.2s" }}
    />
  );
}

/* ── main component ─────────────────────────────────── */
export default function MapaEstrategico() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();
  const [selectedPillarId, setSelectedPillarId] = useState<string | null>(null);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);
  const visionRef = useRef<HTMLDivElement>(null);
  const pillarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const obstacleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const actionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const selectedPillar = pillars?.find((p) => p.id === selectedPillarId) ?? null;
  const selectedObstacle = selectedPillar?.obstacles.find((o) => o.id === selectedObstacleId) ?? null;

  const allActions = useMemo(() => pillars?.flatMap((p) => p.obstacles.flatMap((o) => o.actions)) ?? [], [pillars]);
  const responsibles = useMemo(() => {
    const set = new Set(allActions.map((a) => a.responsible).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [allActions]);
  const counters = useMemo(() => {
    const total = allActions.length;
    const concluidas = allActions.filter((a) => getComputedStatus(a) === "concluido").length;
    const emAndamento = allActions.filter((a) => getComputedStatus(a) === "em_andamento").length;
    const atrasadas = allActions.filter((a) => getComputedStatus(a) === "atrasado").length;
    return { total, concluidas, emAndamento, atrasadas };
  }, [allActions]);

  const matchesFilter = (a: Action) => {
    const cs = getComputedStatus(a);
    if (statusFilter !== "todos" && cs !== statusFilter) return false;
    if (responsibleFilter !== "todos" && a.responsible !== responsibleFilter) return false;
    return true;
  };

  const handleSelectPillar = (id: string) => {
    setSelectedPillarId(id === selectedPillarId ? null : id);
    setSelectedObstacleId(null);
  };
  const handleSelectObstacle = (id: string) => {
    setSelectedObstacleId(id === selectedObstacleId ? null : id);
  };

  const handleSaveAction = async () => {
    if (!editingAction) return;
    const { id, ...rest } = editingAction;
    const { error } = await supabase
      .from("actions")
      .update({
        description: rest.description, area: rest.area, expected_result: rest.expected_result,
        deliverable: rest.deliverable, responsible: rest.responsible, deadline: rest.deadline,
        status: rest.status, importance: rest.importance, urgency: rest.urgency,
        reliability: rest.reliability, execution_order: rest.execution_order,
      })
      .eq("id", id);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: "Ação atualizada!" }); queryClient.invalidateQueries({ queryKey: ["strategic-map"] }); setEditingAction(null); }
  };

  // Force recalc connectors when selections change
  const [, forceUpdate] = useState(0);
  useEffect(() => { const t = setTimeout(() => forceUpdate((n) => n + 1), 50); return () => clearTimeout(t); }, [selectedPillarId, selectedObstacleId]);

  if (isLoading) {
    return <div className="p-6 flex items-center justify-center h-full"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Counters & Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border bg-background shrink-0">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm px-3 py-1">{counters.total} ações</Badge>
          <Badge className="bg-status-completed text-primary-foreground text-sm px-3 py-1">{counters.concluidas} concluídas</Badge>
          <Badge className="bg-status-in-progress text-primary-foreground text-sm px-3 py-1">{counters.emAndamento} em andamento</Badge>
          <Badge className="bg-status-overdue text-primary-foreground text-sm px-3 py-1">{counters.atrasadas} atrasadas</Badge>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsibles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mind-map area */}
      <div className="flex-1 overflow-auto p-6" ref={containerRef} style={{ position: "relative" }}>
        {/* SVG overlay for connectors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {/* Vision → Pillars */}
          {pillars?.map((p) => {
            const pRef = { current: pillarRefs.current.get(p.id) ?? null };
            return <Connector key={`v-${p.id}`} from={visionRef as any} to={pRef} active={p.id === selectedPillarId} containerRef={containerRef} />;
          })}
          {/* Selected Pillar → Obstacles */}
          {selectedPillar?.obstacles.map((o) => {
            const pRef = { current: pillarRefs.current.get(selectedPillar.id) ?? null };
            const oRef = { current: obstacleRefs.current.get(o.id) ?? null };
            return <Connector key={`p-${o.id}`} from={pRef} to={oRef} active={o.id === selectedObstacleId} containerRef={containerRef} />;
          })}
          {/* Selected Obstacle → Actions */}
          {selectedObstacle?.actions.map((a) => {
            const oRef = { current: obstacleRefs.current.get(selectedObstacle.id) ?? null };
            const aRef = { current: actionRefs.current.get(a.id) ?? null };
            return <Connector key={`o-${a.id}`} from={oRef} to={aRef} active containerRef={containerRef} />;
          })}
        </svg>

        {/* Columns container */}
        <div className="flex items-start gap-8 min-w-max" style={{ position: "relative", zIndex: 2 }}>
          {/* Col 1: Vision */}
          <div className="flex flex-col justify-center shrink-0" style={{ minHeight: 200 }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  ref={visionRef}
                  className="w-56 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30 p-4 cursor-default shadow-sm"
                >
                  <Badge className="bg-primary text-primary-foreground mb-2 text-xs">Visão {vision?.reference_year}</Badge>
                  <p className="text-sm text-foreground line-clamp-4 leading-relaxed">{vision?.text}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md"><p className="text-sm">{vision?.text}</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Col 2: Pillars */}
          <div className="flex flex-col gap-2 shrink-0">
            {pillars?.map((p) => (
              <div
                key={p.id}
                ref={(el) => { if (el) pillarRefs.current.set(p.id, el); }}
                onClick={() => handleSelectPillar(p.id)}
                className={`w-56 rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-md ${
                  p.id === selectedPillarId
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <p className="text-xs font-semibold text-primary">Pilar {p.number}</p>
                <p className="text-sm text-foreground font-medium mt-1 line-clamp-2">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.obstacles.length} obst. · {p.obstacles.reduce((s, o) => s + o.actions.length, 0)} ações
                </p>
              </div>
            ))}
          </div>

          {/* Col 3: Obstacles */}
          {selectedPillar && (
            <div className="flex flex-col gap-2 shrink-0 animate-in slide-in-from-left-4 duration-200">
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Obstáculos — Pilar {selectedPillar.number}</p>
              {selectedPillar.obstacles.map((o) => (
                <div
                  key={o.id}
                  ref={(el) => { if (el) obstacleRefs.current.set(o.id, el); }}
                  onClick={() => handleSelectObstacle(o.id)}
                  className={`w-60 rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-md ${
                    o.id === selectedObstacleId
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{o.code}</p>
                  {o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{o.actions.length} ações</p>
                </div>
              ))}
            </div>
          )}

          {/* Col 4: Actions */}
          {selectedObstacle && (
            <div className="flex flex-col gap-2 shrink-0 animate-in slide-in-from-left-4 duration-200">
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Ações — {selectedObstacle.code}</p>
              {selectedObstacle.actions.map((action) => {
                const cs = getComputedStatus(action);
                const cfg = STATUS_CONFIG[cs];
                const isOverdue = cs === "atrasado";
                const filtered = matchesFilter(action);

                return (
                  <div
                    key={action.id}
                    ref={(el) => { if (el) actionRefs.current.set(action.id, el); }}
                    onClick={() => setEditingAction(action)}
                    className={`w-72 rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 ${
                      !filtered ? "opacity-30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`${cfg.colorClass} text-[10px] shrink-0`}>{cfg.label}</Badge>
                      {action.priority_score != null && (
                        <span className="text-xs font-semibold text-primary ml-auto">{Number(action.priority_score).toFixed(1)}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2 mb-1.5">{action.description}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      {action.responsible && <span>{action.responsible}</span>}
                      {action.deadline && (
                        <span className={isOverdue ? "text-status-overdue font-medium" : ""}>
                          {format(new Date(action.deadline + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Edit Sheet */}
      <Sheet open={!!editingAction} onOpenChange={(open) => !open && setEditingAction(null)}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Editar Ação</SheetTitle></SheetHeader>
          {editingAction && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editingAction.description} onChange={(e) => setEditingAction({ ...editingAction, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={editingAction.area ?? ""} onValueChange={(v) => setEditingAction({ ...editingAction, area: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Resultado Esperado</Label>
                <Textarea value={editingAction.expected_result ?? ""} onChange={(e) => setEditingAction({ ...editingAction, expected_result: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Entregável</Label>
                <Textarea value={editingAction.deliverable ?? ""} onChange={(e) => setEditingAction({ ...editingAction, deliverable: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={editingAction.responsible ?? ""} onChange={(e) => setEditingAction({ ...editingAction, responsible: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input type="date" value={editingAction.deadline ?? ""} onChange={(e) => setEditingAction({ ...editingAction, deadline: e.target.value || null })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingAction.status} onValueChange={(v) => setEditingAction({ ...editingAction, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Importância (1-5)</Label>
                  <Input type="number" min={1} max={5} value={editingAction.importance ?? ""} onChange={(e) => setEditingAction({ ...editingAction, importance: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label>Urgência (1-5)</Label>
                  <Input type="number" min={1} max={5} value={editingAction.urgency ?? ""} onChange={(e) => setEditingAction({ ...editingAction, urgency: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label>Confiabilidade (1-5)</Label>
                  <Input type="number" min={1} max={5} value={editingAction.reliability ?? ""} onChange={(e) => setEditingAction({ ...editingAction, reliability: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Score de Prioridade</Label>
                  <Input value={editingAction.priority_score != null ? Number(editingAction.priority_score).toFixed(2) : "—"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Ordem de Execução</Label>
                  <Input type="number" value={editingAction.execution_order ?? ""} onChange={(e) => setEditingAction({ ...editingAction, execution_order: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveAction}>Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
