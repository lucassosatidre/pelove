import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVision, useStrategicMap, getComputedStatus, STATUS_CONFIG, PILLAR_COLORS, AREA_OPTIONS, Action } from "@/hooks/useStrategicData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Expand, Minimize2, Filter } from "lucide-react";
import { format } from "date-fns";

export default function MapaEstrategico() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set());
  const [expandedObstacles, setExpandedObstacles] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("todos");
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const allActions = useMemo(() => {
    if (!pillars) return [];
    return pillars.flatMap((p) => p.obstacles.flatMap((o) => o.actions));
  }, [pillars]);

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

  const filteredActions = (actions: Action[]) => {
    return actions.filter((a) => {
      const cs = getComputedStatus(a);
      if (statusFilter !== "todos" && cs !== statusFilter) return false;
      if (responsibleFilter !== "todos" && a.responsible !== responsibleFilter) return false;
      return true;
    });
  };

  const toggleAll = (expand: boolean) => {
    if (!pillars) return;
    if (expand) {
      setExpandedPillars(new Set(pillars.map((p) => p.id)));
      setExpandedObstacles(new Set(pillars.flatMap((p) => p.obstacles.map((o) => o.id))));
    } else {
      setExpandedPillars(new Set());
      setExpandedObstacles(new Set());
    }
  };

  const handleSaveAction = async () => {
    if (!editingAction) return;
    const { id, ...rest } = editingAction;
    const { error } = await supabase
      .from("actions")
      .update({
        description: rest.description,
        area: rest.area,
        expected_result: rest.expected_result,
        deliverable: rest.deliverable,
        responsible: rest.responsible,
        deadline: rest.deadline,
        status: rest.status,
        importance: rest.importance,
        urgency: rest.urgency,
        reliability: rest.reliability,
        execution_order: rest.execution_order,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ação atualizada!" });
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
      setEditingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-md bg-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Vision */}
      {vision && (
        <Card className="bg-gradient-to-r from-primary/10 to-background border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Badge className="bg-primary text-primary-foreground mb-3">Visão {vision.reference_year}</Badge>
                <p className="text-foreground leading-relaxed">{vision.text}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Counters & Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsibles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>
            <Expand className="h-4 w-4 mr-1" /> Expandir
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>
            <Minimize2 className="h-4 w-4 mr-1" /> Recolher
          </Button>
        </div>
      </div>

      {/* Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pillars?.map((pillar, idx) => {
          const isExpanded = expandedPillars.has(pillar.id);
          const totalActions = pillar.obstacles.reduce((s, o) => s + o.actions.length, 0);
          const completedActions = pillar.obstacles.reduce(
            (s, o) => s + o.actions.filter((a) => getComputedStatus(a) === "concluido").length, 0
          );
          const colorClass = PILLAR_COLORS[idx % PILLAR_COLORS.length];

          return (
            <Card
              key={pillar.id}
              className={`border-l-4 ${colorClass} ${isExpanded ? "md:col-span-2" : ""} transition-all`}
            >
              <CardContent className="p-4">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => {
                    const next = new Set(expandedPillars);
                    if (isExpanded) { next.delete(pillar.id); } else { next.add(pillar.id); }
                    setExpandedPillars(next);
                  }}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <span className="font-semibold text-foreground">Pilar {pillar.number}</span>
                      <span className="text-muted-foreground mx-2">—</span>
                      <span className="text-foreground">{pillar.name}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {pillar.obstacles.length} obstáculos · {totalActions} ações · {completedActions} concluídas
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-3 pl-4">
                    {pillar.obstacles.map((obs) => {
                      const obsExpanded = expandedObstacles.has(obs.id);
                      const filtered = filteredActions(obs.actions);

                      return (
                        <div key={obs.id} className="border border-border rounded-lg p-3">
                          <button
                            className="w-full flex items-center justify-between text-left"
                            onClick={() => {
                              const next = new Set(expandedObstacles);
                              if (obsExpanded) { next.delete(obs.id); } else { next.add(obs.id); }
                              setExpandedObstacles(next);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {obsExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <span className="font-medium text-foreground">{obs.code}</span>
                              {obs.description && <span className="text-muted-foreground text-sm">— {obs.description}</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{obs.actions.length} ações</span>
                          </button>

                          {obsExpanded && filtered.length > 0 && (
                            <div className="mt-3 space-y-2 pl-6">
                              {filtered.map((action) => {
                                const cs = getComputedStatus(action);
                                const cfg = STATUS_CONFIG[cs];
                                const isOverdue = cs === "atrasado";

                                return (
                                  <button
                                    key={action.id}
                                    className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent/50 transition-colors text-left"
                                    onClick={() => setEditingAction(action)}
                                  >
                                    <Badge className={`${cfg.colorClass} text-xs shrink-0`}>{cfg.label}</Badge>
                                    <span className="text-sm text-foreground flex-1 line-clamp-2">{action.description}</span>
                                    {action.area && <Badge variant="outline" className="text-xs shrink-0">{action.area}</Badge>}
                                    {action.responsible && <span className="text-xs text-muted-foreground shrink-0">{action.responsible}</span>}
                                    {action.deadline && (
                                      <span className={`text-xs shrink-0 ${isOverdue ? "text-status-overdue font-medium" : "text-muted-foreground"}`}>
                                        {format(new Date(action.deadline + "T12:00:00"), "dd/MM/yyyy")}
                                      </span>
                                    )}
                                    {action.priority_score != null && (
                                      <span className="text-xs font-medium text-primary shrink-0">{Number(action.priority_score).toFixed(1)}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {obsExpanded && filtered.length === 0 && (
                            <p className="text-xs text-muted-foreground pl-6 mt-2">Nenhuma ação com os filtros atuais.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Edit Sheet */}
      <Sheet open={!!editingAction} onOpenChange={(open) => !open && setEditingAction(null)}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Editar Ação</SheetTitle>
          </SheetHeader>
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
                  <SelectContent>
                    {AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
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
