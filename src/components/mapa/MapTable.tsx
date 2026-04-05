import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStrategicMap, type Obstacle, type Action, getComputedStatus } from "@/hooks/useStrategicData";
import { InlineText } from "./InlineText";
import { StatusSelect, getRowBg, getStatusDot } from "./StatusSelect";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PILLAR_BORDER_COLORS = [
  "border-l-[hsl(var(--pillar-1))]",
  "border-l-[hsl(var(--pillar-2))]",
  "border-l-[hsl(var(--pillar-3))]",
  "border-l-[hsl(var(--pillar-4))]",
  "border-l-[hsl(var(--pillar-5))]",
  "border-l-[hsl(var(--pillar-6))]",
];

const HEADER_COLS = ["Pilar", "Obstáculo", "Ação", "Resultado Esperado", "Entregável", "Responsável", "Prazo", "Status"];
const COL_MIN = [150, 180, 250, 200, 220, 120, 110, 120];

/* ─── Sortable action row ─── */
function SortableRow({ action, onUpdate, listeners: _l, ...rest }: {
  action: Action;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
  listeners?: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, display: "contents" }}
      className={isDragging ? "opacity-50" : ""}
    >
      {/* Ação */}
      <div className={cn("border-b border-r border-border px-2 py-1.5 flex items-center gap-1.5", getRowBg(action))}>
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusDot(action))} />
        <InlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className="text-xs" />
      </div>
      {/* Resultado */}
      <div className={cn("border-b border-r border-border px-2 py-1.5", getRowBg(action))}>
        <InlineText value={action.expected_result ?? ""} onSave={(v) => onUpdate(action.id, "expected_result", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Entregável */}
      <div className={cn("border-b border-r border-border px-2 py-1.5", getRowBg(action))}>
        <InlineText value={action.deliverable ?? ""} onSave={(v) => onUpdate(action.id, "deliverable", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Responsável */}
      <div className={cn("border-b border-r border-border px-2 py-1.5", getRowBg(action))}>
        <InlineText value={action.responsible ?? ""} onSave={(v) => onUpdate(action.id, "responsible", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Prazo */}
      <div className={cn("border-b border-r border-border px-2 py-1.5", getRowBg(action))}>
        <DeadlineInline deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
      </div>
      {/* Status */}
      <div className={cn("border-b border-border px-2 py-1.5", getRowBg(action))}>
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </div>
    </div>
  );
}

function DeadlineInline({ deadline, isOverdue, onSave }: { deadline: string | null; isOverdue: boolean; onSave: (v: string | null) => Promise<void> }) {
  const [flash, setFlash] = useState(false);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null;
    await onSave(val);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };
  return (
    <div className={cn("transition-colors duration-300 rounded", flash && "bg-green-100")}>
      <input
        type="date"
        value={deadline ?? ""}
        onChange={handleChange}
        className={cn("bg-transparent text-xs border-none focus:outline-none focus:ring-0 cursor-pointer w-full", isOverdue && "text-destructive font-medium")}
      />
    </div>
  );
}

/* ─── Main Table ─── */
export function MapTable() {
  const { data: pillars, isLoading } = useStrategicMap();
  const qc = useQueryClient();
  const [newObstacles, setNewObstacles] = useState<Record<string, boolean>>({});
  const [newActions, setNewActions] = useState<Record<string, boolean>>({});
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
    if (!code.trim()) { setNewObstacles(p => ({ ...p, [pillarId]: false })); return; }
    const pillar = pillars?.find(p => p.id === pillarId);
    const next = (pillar?.obstacles.length ?? 0) + 1;
    await supabase.from("obstacles").insert({ pillar_id: pillarId, code: code.trim(), display_order: next });
    invalidate();
    setNewObstacles(p => ({ ...p, [pillarId]: false }));
  }, [pillars, invalidate]);

  const addAction = useCallback(async (obstacleId: string, desc: string) => {
    if (!desc.trim()) { setNewActions(p => ({ ...p, [obstacleId]: false })); return; }
    const obs = pillars?.flatMap(p => p.obstacles).find(o => o.id === obstacleId);
    const next = (obs?.actions.length ?? 0) + 1;
    await supabase.from("actions").insert({ obstacle_id: obstacleId, description: desc.trim(), execution_order: next });
    invalidate();
    setNewActions(p => ({ ...p, [obstacleId]: false }));
  }, [pillars, invalidate]);

  const handleDragEnd = useCallback(async (event: DragEndEvent, obstacle: Obstacle) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = obstacle.actions.findIndex(a => a.id === active.id);
    const newIdx = obstacle.actions.findIndex(a => a.id === over.id);
    const reordered = arrayMove(obstacle.actions, oldIdx, newIdx);
    await Promise.all(reordered.map((a, i) => supabase.from("actions").update({ execution_order: i + 1 }).eq("id", a.id)));
    invalidate();
  }, [invalidate]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div
        className="grid min-w-[1350px]"
        style={{ gridTemplateColumns: `${COL_MIN[0]}px ${COL_MIN[1]}px minmax(${COL_MIN[2]}px,1fr) minmax(${COL_MIN[3]}px,1fr) minmax(${COL_MIN[4]}px,1fr) ${COL_MIN[5]}px ${COL_MIN[6]}px ${COL_MIN[7]}px` }}
      >
        {/* Header */}
        {HEADER_COLS.map((h) => (
          <div key={h} className="sticky top-0 z-20 bg-secondary text-secondary-foreground text-[10px] uppercase tracking-widest font-semibold px-2 py-2 border-b border-r border-secondary-foreground/10 last:border-r-0">
            {h}
          </div>
        ))}

        {/* Body */}
        {pillars?.map((pillar, pIdx) => {
          // Count total rows for this pillar to compute rowSpan equivalent via grid-row span
          const borderColor = PILLAR_BORDER_COLORS[pIdx % 6];

          return pillar.obstacles.map((obstacle, oIdx) => (
            <ObstacleBlock
              key={obstacle.id}
              pillar={pillar}
              pillarIdx={pIdx}
              obstacle={obstacle}
              obstacleIdx={oIdx}
              borderColor={borderColor}
              sensors={sensors}
              updateAction={updateAction}
              updatePillar={updatePillar}
              updateObstacle={updateObstacle}
              handleDragEnd={handleDragEnd}
              newAction={!!newActions[obstacle.id]}
              onAddAction={() => setNewActions(p => ({ ...p, [obstacle.id]: true }))}
              addAction={addAction}
              showPillar={oIdx === 0}
              showAddObstacle={oIdx === pillar.obstacles.length - 1}
              newObstacle={oIdx === pillar.obstacles.length - 1 && !!newObstacles[pillar.id]}
              onAddObstacle={() => setNewObstacles(p => ({ ...p, [pillar.id]: true }))}
              addObstacle={addObstacle}
            />
          ));
        })}

        {/* New pillar row */}
        <div className="col-span-8 border-b border-border px-2 py-2">
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

/* ─── Obstacle Block ─── */
function ObstacleBlock({
  pillar, pillarIdx, obstacle, obstacleIdx, borderColor, sensors,
  updateAction, updatePillar, updateObstacle, handleDragEnd,
  newAction, onAddAction, addAction,
  showPillar, showAddObstacle, newObstacle, onAddObstacle, addObstacle,
}: {
  pillar: any; pillarIdx: number; obstacle: Obstacle; obstacleIdx: number; borderColor: string; sensors: any;
  updateAction: (id: string, f: string, v: any) => Promise<void>;
  updatePillar: (id: string, n: string) => Promise<void>;
  updateObstacle: (id: string, f: string, v: string) => Promise<void>;
  handleDragEnd: (e: DragEndEvent, o: Obstacle) => void;
  newAction: boolean; onAddAction: () => void; addAction: (oid: string, d: string) => Promise<void>;
  showPillar: boolean; showAddObstacle: boolean;
  newObstacle: boolean; onAddObstacle: () => void; addObstacle: (pid: string, c: string) => Promise<void>;
}) {
  const actionRows = obstacle.actions.length || 1; // at least 1 row
  const totalRows = actionRows + 1; // +1 for add-action row

  return (
    <>
      {/* Pillar cell - spans all rows of this obstacle group */}
      {showPillar ? (
        <div
          className={cn("border-b border-r border-border px-2 py-2 border-l-4", borderColor)}
          style={{ gridRow: `span ${totalRows}` }}
        >
          <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Pilar {pillar.number}</span>
          <InlineText value={pillar.name} onSave={(v) => updatePillar(pillar.id, v)} className="text-xs font-semibold block mt-0.5" />
        </div>
      ) : (
        <div className={cn("border-b border-r border-border border-l-4", borderColor)} style={{ gridRow: `span ${totalRows}` }} />
      )}

      {/* Obstacle cell - spans all rows */}
      <div className="border-b border-r border-border px-2 py-1.5 align-top" style={{ gridRow: `span ${totalRows}` }}>
        <span className="text-xs font-bold text-primary">{obstacle.code}</span>
        <InlineText
          value={obstacle.description ?? ""}
          onSave={(v) => updateObstacle(obstacle.id, "description", v)}
          placeholder="Clique para definir"
          className="text-xs block mt-0.5"
        />
      </div>

      {/* Action rows */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, obstacle)}>
        <SortableContext items={obstacle.actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {obstacle.actions.length > 0 ? (
            obstacle.actions.map((action) => (
              <SortableRow key={action.id} action={action} onUpdate={updateAction} />
            ))
          ) : (
            /* Empty row placeholder */
            <>
              <div className="border-b border-r border-border px-2 py-1.5 text-xs text-muted-foreground italic col-span-6">
                Nenhuma ação
              </div>
            </>
          )}
        </SortableContext>
      </DndContext>

      {/* Add action row */}
      <div className={cn("border-b border-border px-2 py-1 col-span-6", showAddObstacle && "border-b-2")}>
        {newAction ? (
          <InlineText value="" onSave={(v) => addAction(obstacle.id, v)} placeholder="Descrição da ação..." autoFocus className="text-xs" />
        ) : (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onAddAction}>
            <Plus className="h-3 w-3" /> Ação
          </Button>
        )}
      </div>

      {/* Add obstacle row (after last obstacle of this pillar) */}
      {showAddObstacle && (
        <div className="col-span-8 border-b-2 border-border px-2 py-1">
          {newObstacle ? (
            <InlineText value="" onSave={(v) => addObstacle(pillar.id, v)} placeholder="Código (ex: 1.5)..." autoFocus className="text-xs" />
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onAddObstacle}>
              <Plus className="h-3 w-3" /> Obstáculo
            </Button>
          )}
        </div>
      )}
    </>
  );
}
