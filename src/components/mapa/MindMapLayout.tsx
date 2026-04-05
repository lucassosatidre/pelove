import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStrategicMap, useVision } from "@/hooks/useStrategicData";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { InlineText } from "./InlineText";
import { ActionCard } from "./ActionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Pillar, Obstacle, Action, ActionStatus } from "@/hooks/useStrategicData";

// ─── Connector SVG ───
function Connectors({ refs }: { refs: React.RefObject<HTMLDivElement> }) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  useEffect(() => {
    const container = refs.current;
    if (!container) return;

    const compute = () => {
      const rect = container.getBoundingClientRect();
      const newLines: typeof lines = [];

      // vision → pillars
      const visionEl = container.querySelector("[data-node='vision']");
      const pillarEls = container.querySelectorAll("[data-node='pillar']");
      if (visionEl) {
        const vr = visionEl.getBoundingClientRect();
        pillarEls.forEach((pe) => {
          const pr = pe.getBoundingClientRect();
          newLines.push({
            x1: vr.right - rect.left,
            y1: vr.top + vr.height / 2 - rect.top,
            x2: pr.left - rect.left,
            y2: pr.top + pr.height / 2 - rect.top,
          });
        });
      }

      // pillar → obstacles
      pillarEls.forEach((pe) => {
        const pillarId = pe.getAttribute("data-id");
        const pr = pe.getBoundingClientRect();
        const obsEls = container.querySelectorAll(`[data-node='obstacle'][data-pillar='${pillarId}']`);
        obsEls.forEach((oe) => {
          const or = oe.getBoundingClientRect();
          newLines.push({
            x1: pr.right - rect.left,
            y1: pr.top + pr.height / 2 - rect.top,
            x2: or.left - rect.left,
            y2: or.top + or.height / 2 - rect.top,
          });
        });
      });

      // obstacle → actions
      const obsEls = container.querySelectorAll("[data-node='obstacle']");
      obsEls.forEach((oe) => {
        const obsId = oe.getAttribute("data-id");
        const or = oe.getBoundingClientRect();
        const actEls = container.querySelectorAll(`[data-node='action'][data-obstacle='${obsId}']`);
        actEls.forEach((ae) => {
          const ar = ae.getBoundingClientRect();
          newLines.push({
            x1: or.right - rect.left,
            y1: or.top + or.height / 2 - rect.top,
            x2: ar.left - rect.left,
            y2: ar.top + ar.height / 2 - rect.top,
          });
        });
      });

      setLines(newLines);
    };

    compute();
    const observer = new MutationObserver(compute);
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", compute);
    const interval = setInterval(compute, 1000);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
      clearInterval(interval);
    };
  }, [refs]);

  return (
    <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: "100%", height: "100%" }}>
      {lines.map((l, i) => {
        const dx = (l.x2 - l.x1) * 0.5;
        return (
          <path
            key={i}
            d={`M${l.x1},${l.y1} C${l.x1 + dx},${l.y1} ${l.x2 - dx},${l.y2} ${l.x2},${l.y2}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

// ─── Sortable Pillar Card ───
function SortablePillarCard({ pillar, idx, onUpdate }: {
  pillar: Pillar; idx: number; onUpdate: (id: string, name: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pillar.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const borderVar = `hsl(var(--pillar-${(idx % 6) + 1}))`;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: borderVar }}
      className={cn(
        "bg-card rounded-xl shadow-sm border border-border border-l-4 p-3 min-w-[160px] max-w-[200px]",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="pillar"
      data-id={pillar.id}
    >
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <InlineText value={pillar.name} onSave={(v) => onUpdate(pillar.id, v)} className="text-xs font-semibold" />
      </div>
    </div>
  );
}

// ─── Sortable Obstacle Card ───
function SortableObstacleCard({ obstacle, onUpdate }: {
  obstacle: Obstacle; onUpdate: (id: string, field: string, value: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obstacle.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card rounded-lg border border-border p-2.5 min-w-[180px] max-w-[220px]",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="obstacle"
      data-id={obstacle.id}
      data-pillar={obstacle.pillar_id}
    >
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
          <GripVertical className="h-3 w-3" />
        </button>
        <InlineText
          value={obstacle.description ?? ""}
          onSave={(v) => onUpdate(obstacle.id, "description", v)}
          placeholder="Clique para definir"
          className="text-xs"
        />
      </div>
    </div>
  );
}

export function MindMapLayout() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null!);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["strategic-map"] }), [qc]);
  const invalidateVision = useCallback(() => qc.invalidateQueries({ queryKey: ["vision"] }), [qc]);

  // ─── Mutations ───
  const updateVisionText = useCallback(async (text: string) => {
    if (!vision) return;
    await supabase.from("vision").update({ text }).eq("id", vision.id);
    invalidateVision();
  }, [vision, invalidateVision]);

  const updateVisionYear = useCallback(async (val: string) => {
    if (!vision) return;
    const year = parseInt(val);
    if (isNaN(year)) return;
    await supabase.from("vision").update({ reference_year: year }).eq("id", vision.id);
    invalidateVision();
  }, [vision, invalidateVision]);

  const updatePillar = useCallback(async (id: string, name: string) => {
    await supabase.from("pillars").update({ name }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updateObstacle = useCallback(async (id: string, field: string, value: string) => {
    await supabase.from("obstacles").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updateAction = useCallback(async (id: string, field: string, value: any) => {
    await supabase.from("actions").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const addPillar = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const n = (pillars?.length ?? 0) + 1;
    await supabase.from("pillars").insert({ name: name.trim(), number: n, display_order: n });
    invalidate();
  }, [pillars, invalidate]);

  const addObstacle = useCallback(async (pillarId: string, desc: string) => {
    if (!desc.trim()) return;
    const pillar = pillars?.find(p => p.id === pillarId);
    const next = (pillar?.obstacles.length ?? 0) + 1;
    await supabase.from("obstacles").insert({ pillar_id: pillarId, code: "-", description: desc.trim(), display_order: next });
    invalidate();
  }, [pillars, invalidate]);

  const addAction = useCallback(async (obstacleId: string, desc: string) => {
    if (!desc.trim()) return;
    const obs = pillars?.flatMap(p => p.obstacles).find(o => o.id === obstacleId);
    const next = (obs?.actions.length ?? 0) + 1;
    await supabase.from("actions").insert({ obstacle_id: obstacleId, description: desc.trim(), execution_order: next });
    invalidate();
  }, [pillars, invalidate]);

  // ─── DnD handlers ───
  const handlePillarDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pillars) return;
    const oldIdx = pillars.findIndex(p => p.id === active.id);
    const newIdx = pillars.findIndex(p => p.id === over.id);
    const reordered = arrayMove(pillars, oldIdx, newIdx);
    await Promise.all(reordered.map((p, i) => supabase.from("pillars").update({ display_order: i + 1, number: i + 1 }).eq("id", p.id)));
    invalidate();
  }, [pillars, invalidate]);

  const makeObstacleDragEnd = useCallback((pillar: Pillar) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const visible = pillar.obstacles.filter(o => o.description || o.actions.length > 0);
    const oldIdx = visible.findIndex(o => o.id === active.id);
    const newIdx = visible.findIndex(o => o.id === over.id);
    const reordered = arrayMove(visible, oldIdx, newIdx);
    await Promise.all(reordered.map((o, i) => supabase.from("obstacles").update({ display_order: i + 1 }).eq("id", o.id)));
    invalidate();
  }, [invalidate]);

  const makeActionDragEnd = useCallback((obstacle: Obstacle) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = obstacle.actions.findIndex(a => a.id === active.id);
    const newIdx = obstacle.actions.findIndex(a => a.id === over.id);
    const reordered = arrayMove(obstacle.actions, oldIdx, newIdx);
    await Promise.all(reordered.map((a, i) => supabase.from("actions").update({ execution_order: i + 1 }).eq("id", a.id)));
    invalidate();
  }, [invalidate]);

  // ─── New item states ───
  const [newPillar, setNewPillar] = useState(false);
  const [newObstacles, setNewObstacles] = useState<Record<string, boolean>>({});
  const [newActions, setNewActions] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  // Gather all visible obstacles per pillar for layout
  const visibleData = pillars?.map(p => ({
    ...p,
    visibleObstacles: p.obstacles.filter(o => o.description || o.actions.length > 0),
  })) ?? [];

  return (
    <div className="flex-1 overflow-auto">
      <div ref={containerRef} className="relative flex items-start gap-16 p-8 min-w-max">
        <Connectors refs={containerRef} />

        {/* ─── Column 1: Vision ─── */}
        {vision && (
          <div className="flex flex-col items-center z-10 shrink-0" style={{ minWidth: 200, maxWidth: 240 }}>
            <div
              className="bg-card rounded-xl shadow-md border border-primary/20 p-4 w-full"
              data-node="vision"
            >
              <Badge className="bg-primary text-primary-foreground mb-2">
                Visão{" "}
                <InlineText
                  value={String(vision.reference_year)}
                  onSave={updateVisionYear}
                  className="text-primary-foreground font-bold"
                  inputClassName="w-16 text-foreground"
                />
              </Badge>
              <InlineText
                value={vision.text}
                onSave={updateVisionText}
                multiline
                className="text-xs leading-relaxed text-foreground block mt-1"
                inputClassName="text-xs"
              />
            </div>
          </div>
        )}

        {/* ─── Column 2: Pillars ─── */}
        <div className="flex flex-col gap-3 z-10 shrink-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePillarDragEnd}>
            <SortableContext items={visibleData.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {visibleData.map((pillar, idx) => (
                <SortablePillarCard key={pillar.id} pillar={pillar} idx={idx} onUpdate={updatePillar} />
              ))}
            </SortableContext>
          </DndContext>
          {newPillar ? (
            <div className="min-w-[160px]">
              <InlineText value="" onSave={(v) => { addPillar(v); setNewPillar(false); }} placeholder="Nome do pilar..." autoFocus className="text-xs font-semibold" />
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1 self-start" onClick={() => setNewPillar(true)}>
              <Plus className="h-3 w-3" /> Pilar
            </Button>
          )}
        </div>

        {/* ─── Column 3: Obstacles ─── */}
        <div className="flex flex-col gap-3 z-10 shrink-0">
          {visibleData.map((pillar) => (
            <div key={pillar.id} className="flex flex-col gap-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeObstacleDragEnd(pillar)}>
                <SortableContext items={pillar.visibleObstacles.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  {pillar.visibleObstacles.map((obs) => (
                    <SortableObstacleCard key={obs.id} obstacle={obs} onUpdate={updateObstacle} />
                  ))}
                </SortableContext>
              </DndContext>
              {newObstacles[pillar.id] ? (
                <div className="min-w-[180px]">
                  <InlineText
                    value=""
                    onSave={(v) => { addObstacle(pillar.id, v); setNewObstacles(p => ({ ...p, [pillar.id]: false })); }}
                    placeholder="Descrição..."
                    autoFocus
                    className="text-xs"
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-6 gap-1 self-start"
                  onClick={() => setNewObstacles(p => ({ ...p, [pillar.id]: true }))}
                >
                  <Plus className="h-3 w-3" /> Obstáculo
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* ─── Column 4: Actions ─── */}
        <div className="flex flex-col gap-3 z-10 shrink-0">
          {visibleData.flatMap((pillar) =>
            pillar.visibleObstacles.map((obs) => (
              <div key={obs.id} className="flex flex-col gap-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeActionDragEnd(obs)}>
                  <SortableContext items={obs.actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {obs.actions.map((action) => (
                      <ActionCard key={action.id} action={action} obstacleId={obs.id} onUpdate={updateAction} />
                    ))}
                  </SortableContext>
                </DndContext>
                {newActions[obs.id] ? (
                  <div className="min-w-[260px]">
                    <InlineText
                      value=""
                      onSave={(v) => { addAction(obs.id, v); setNewActions(p => ({ ...p, [obs.id]: false })); }}
                      placeholder="Descrição da ação..."
                      autoFocus
                      className="text-xs"
                    />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-6 gap-1 self-start"
                    onClick={() => setNewActions(p => ({ ...p, [obs.id]: true }))}
                  >
                    <Plus className="h-3 w-3" /> Ação
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
