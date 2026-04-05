import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStrategicMap } from "@/hooks/useStrategicData";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { SortablePillarBlock } from "./PillarBlock";
import { ACTION_COLS } from "./ActionRow";
import { InlineText } from "./InlineText";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const HEADER_LEFT = [
  { label: "Pilar", width: 150 },
  { label: "Obstáculo", width: 180 },
];
const HEADER_ACTION = ["Ação", "Resultado Esperado", "Entregável", "Responsável", "Prazo", "Status"];

export function MapTable() {
  const { data: pillars, isLoading } = useStrategicMap();
  const qc = useQueryClient();
  const [newPillar, setNewPillar] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["strategic-map"] }), [qc]);

  const updateAction = useCallback(async (id: string, field: string, value: any) => {
    await supabase.from("actions").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updatePillar = useCallback(async (id: string, name: string) => {
    await supabase.from("pillars").update({ name }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updateObstacle = useCallback(async (id: string, field: string, value: string) => {
    await supabase.from("obstacles").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const addPillar = useCallback(async (name: string) => {
    if (!name.trim()) { setNewPillar(false); return; }
    const n = (pillars?.length ?? 0) + 1;
    await supabase.from("pillars").insert({ name: name.trim(), number: n, display_order: n });
    invalidate();
    setNewPillar(false);
  }, [pillars, invalidate]);

  const addObstacle = useCallback(async (pillarId: string, code: string) => {
    const pillar = pillars?.find(p => p.id === pillarId);
    const next = (pillar?.obstacles.length ?? 0) + 1;
    await supabase.from("obstacles").insert({ pillar_id: pillarId, code: code.trim(), display_order: next });
    invalidate();
  }, [pillars, invalidate]);

  const addAction = useCallback(async (obstacleId: string, desc: string) => {
    const obs = pillars?.flatMap(p => p.obstacles).find(o => o.id === obstacleId);
    const next = (obs?.actions.length ?? 0) + 1;
    await supabase.from("actions").insert({ obstacle_id: obstacleId, description: desc.trim(), execution_order: next });
    invalidate();
  }, [pillars, invalidate]);

  const handlePillarDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pillars) return;
    const oldIdx = pillars.findIndex(p => p.id === active.id);
    const newIdx = pillars.findIndex(p => p.id === over.id);
    const reordered = arrayMove(pillars, oldIdx, newIdx);
    await Promise.all(reordered.map((p, i) => supabase.from("pillars").update({ display_order: i + 1, number: i + 1 }).eq("id", p.id)));
    invalidate();
  }, [pillars, invalidate]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[1350px]">
        {/* Header */}
        <div className="flex sticky top-0 z-20">
          {HEADER_LEFT.map(h => (
            <div
              key={h.label}
              className="bg-secondary text-secondary-foreground text-[10px] uppercase tracking-widest font-semibold px-2 py-2 border-b border-r border-secondary-foreground/10 flex-shrink-0"
              style={{ width: h.width, minWidth: h.width }}
            >
              {h.label}
            </div>
          ))}
          <div className="flex-1 grid" style={{ gridTemplateColumns: ACTION_COLS }}>
            {HEADER_ACTION.map((h, i) => (
              <div
                key={h}
                className="bg-secondary text-secondary-foreground text-[10px] uppercase tracking-widest font-semibold px-2 py-2 border-b border-r border-secondary-foreground/10 last:border-r-0"
              >
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePillarDragEnd}>
          <SortableContext items={pillars?.map(p => p.id) ?? []} strategy={verticalListSortingStrategy}>
            {pillars?.map((pillar, idx) => (
              <SortablePillarBlock
                key={pillar.id}
                pillar={pillar}
                pillarIdx={idx}
                onUpdatePillar={updatePillar}
                onUpdateObstacle={updateObstacle}
                onUpdateAction={updateAction}
                onAddObstacle={addObstacle}
                onAddAction={addAction}
                invalidate={invalidate}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* New pillar */}
        <div className="px-2 py-2 border-b border-border">
          {newPillar ? (
            <InlineText value="" onSave={addPillar} placeholder="Nome do pilar..." autoFocus className="text-xs font-semibold" />
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => setNewPillar(true)}>
              <Plus className="h-3 w-3" /> Novo Pilar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
