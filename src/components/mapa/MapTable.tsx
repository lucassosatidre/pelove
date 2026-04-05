import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStrategicMap, type Pillar, type Obstacle, type Action, type ActionStatus, getComputedStatus } from "@/hooks/useStrategicData";
import { InlineText } from "./InlineText";
import { StatusSelect, getRowBg, getStatusDot } from "./StatusSelect";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
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

const COL_WIDTHS = "min-w-[150px] min-w-[180px] min-w-[250px] min-w-[200px] min-w-[220px] min-w-[120px] min-w-[110px] min-w-[120px]";

const HEADER_COLS = ["Pilar", "Obstáculo", "Ação", "Resultado Esperado", "Entregável", "Responsável", "Prazo", "Status"];
const COL_MIN = [150, 180, 250, 200, 220, 120, 110, 120];

function SortableActionRow({
  action,
  pillarIdx,
  onUpdateAction,
}: {
  action: Action;
  pillarIdx: number;
  onUpdateAction: (id: string, field: string, value: any) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn("border-b border-border transition-colors", getRowBg(action), isDragging && "opacity-50 z-50")}
    >
      {/* Pilar & Obstacle cells are empty for action rows */}
      <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />
      <td className="border-r border-border" />
      <td className="border-r border-border px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusDot(action))} />
          <InlineText
            value={action.description}
            onSave={(v) => onUpdateAction(action.id, "description", v)}
            className="text-xs"
          />
        </div>
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdateAction(action.id, "expected_result", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdateAction(action.id, "deliverable", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.responsible ?? ""}
          onSave={(v) => onUpdateAction(action.id, "responsible", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <DeadlineCell
          deadline={action.deadline}
          isOverdue={isOverdue}
          onSave={(v) => onUpdateAction(action.id, "deadline", v)}
        />
      </td>
      <td className="px-2 py-1.5">
        <StatusSelect action={action} onSave={(v) => onUpdateAction(action.id, "status", v)} />
      </td>
    </tr>
  );
}

function DeadlineCell({ deadline, isOverdue, onSave }: { deadline: string | null; isOverdue: boolean; onSave: (v: string | null) => Promise<void> }) {
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
        className={cn(
          "bg-transparent text-xs border-none focus:outline-none focus:ring-0 cursor-pointer w-full",
          isOverdue && "text-destructive font-medium"
        )}
      />
    </div>
  );
}

export function MapTable() {
  const { data: pillars, isLoading } = useStrategicMap();
  const qc = useQueryClient();
  const [newPillarName, setNewPillarName] = useState<string | null>(null);
  const [newObstacles, setNewObstacles] = useState<Record<string, boolean>>({});
  const [newActions, setNewActions] = useState<Record<string, boolean>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["strategic-map"] }), [qc]);

  const onUpdateAction = useCallback(async (id: string, field: string, value: any) => {
    await supabase.from("actions").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const onUpdatePillar = useCallback(async (id: string, name: string) => {
    await supabase.from("pillars").update({ name }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const onUpdateObstacle = useCallback(async (id: string, field: string, value: string) => {
    await supabase.from("obstacles").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const addPillar = useCallback(async (name: string) => {
    if (!name.trim()) { setNewPillarName(null); return; }
    const nextNumber = (pillars?.length ?? 0) + 1;
    await supabase.from("pillars").insert({ name: name.trim(), number: nextNumber, display_order: nextNumber });
    invalidate();
    setNewPillarName(null);
  }, [pillars, invalidate]);

  const addObstacle = useCallback(async (pillarId: string, code: string) => {
    if (!code.trim()) { setNewObstacles(prev => ({ ...prev, [pillarId]: false })); return; }
    const pillar = pillars?.find(p => p.id === pillarId);
    const nextOrder = (pillar?.obstacles.length ?? 0) + 1;
    await supabase.from("obstacles").insert({ pillar_id: pillarId, code: code.trim(), display_order: nextOrder });
    invalidate();
    setNewObstacles(prev => ({ ...prev, [pillarId]: false }));
  }, [pillars, invalidate]);

  const addAction = useCallback(async (obstacleId: string, description: string) => {
    if (!description.trim()) { setNewActions(prev => ({ ...prev, [obstacleId]: false })); return; }
    const obstacle = pillars?.flatMap(p => p.obstacles).find(o => o.id === obstacleId);
    const nextOrder = (obstacle?.actions.length ?? 0) + 1;
    await supabase.from("actions").insert({ obstacle_id: obstacleId, description: description.trim(), execution_order: nextOrder });
    invalidate();
    setNewActions(prev => ({ ...prev, [obstacleId]: false }));
  }, [pillars, invalidate]);

  const handleDragEnd = useCallback(async (event: DragEndEvent, obstacle: Obstacle) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = obstacle.actions.findIndex(a => a.id === active.id);
    const newIndex = obstacle.actions.findIndex(a => a.id === over.id);
    const reordered = arrayMove(obstacle.actions, oldIndex, newIndex);
    // Batch update execution_order
    await Promise.all(
      reordered.map((a, i) => supabase.from("actions").update({ execution_order: i + 1 }).eq("id", a.id))
    );
    invalidate();
  }, [invalidate]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse min-w-[1350px]">
        <thead className="sticky top-0 z-20">
          <tr className="bg-secondary text-secondary-foreground">
            {HEADER_COLS.map((h, i) => (
              <th
                key={h}
                className="text-[10px] uppercase tracking-widest font-semibold px-2 py-2 text-left border-r border-secondary-foreground/10 last:border-r-0"
                style={{ minWidth: COL_MIN[i] }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pillars?.map((pillar, pIdx) => {
            const totalActions = pillar.obstacles.reduce((s, o) => s + o.actions.length, 0);
            const pillarRowSpan = Math.max(1, totalActions + pillar.obstacles.length + (pillar.obstacles.length > 0 ? pillar.obstacles.length : 0));

            return pillar.obstacles.map((obstacle, oIdx) => {
              return (
                <ObstacleGroup
                  key={obstacle.id}
                  pillar={pillar}
                  pillarIdx={pIdx}
                  obstacle={obstacle}
                  obstacleIdx={oIdx}
                  isFirstObstacle={oIdx === 0}
                  isLastObstacle={oIdx === pillar.obstacles.length - 1}
                  sensors={sensors}
                  onUpdateAction={onUpdateAction}
                  onUpdatePillar={onUpdatePillar}
                  onUpdateObstacle={onUpdateObstacle}
                  onDragEnd={handleDragEnd}
                  onAddAction={() => setNewActions(prev => ({ ...prev, [obstacle.id]: true }))}
                  newAction={!!newActions[obstacle.id]}
                  addAction={addAction}
                  onAddObstacle={() => setNewObstacles(prev => ({ ...prev, [pillar.id]: true }))}
                  newObstacle={oIdx === pillar.obstacles.length - 1 && !!newObstacles[pillar.id]}
                  addObstacle={addObstacle}
                />
              );
            });
          })}

          {/* New Pillar row */}
          <tr className="border-b border-border">
            <td colSpan={8} className="px-2 py-2">
              {newPillarName !== null ? (
                <InlineText
                  value=""
                  onSave={addPillar}
                  placeholder="Nome do pilar..."
                  autoFocus
                  className="text-xs font-semibold"
                />
              ) : (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => setNewPillarName("")}>
                  <Plus className="h-3 w-3" /> Novo Pilar
                </Button>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ObstacleGroup({
  pillar,
  pillarIdx,
  obstacle,
  obstacleIdx,
  isFirstObstacle,
  isLastObstacle,
  sensors,
  onUpdateAction,
  onUpdatePillar,
  onUpdateObstacle,
  onDragEnd,
  onAddAction,
  newAction,
  addAction,
  onAddObstacle,
  newObstacle,
  addObstacle,
}: {
  pillar: Pillar;
  pillarIdx: number;
  obstacle: Obstacle;
  obstacleIdx: number;
  isFirstObstacle: boolean;
  isLastObstacle: boolean;
  sensors: any;
  onUpdateAction: (id: string, field: string, value: any) => Promise<void>;
  onUpdatePillar: (id: string, name: string) => Promise<void>;
  onUpdateObstacle: (id: string, field: string, value: string) => Promise<void>;
  onDragEnd: (event: DragEndEvent, obstacle: Obstacle) => void;
  onAddAction: () => void;
  newAction: boolean;
  addAction: (obstacleId: string, description: string) => Promise<void>;
  onAddObstacle: () => void;
  newObstacle: boolean;
  addObstacle: (pillarId: string, code: string) => Promise<void>;
}) {
  const actionCount = obstacle.actions.length;
  const totalRows = actionCount + (newAction ? 1 : 0) + 1; // +1 for add action button row

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, obstacle)}>
        <SortableContext items={obstacle.actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {obstacle.actions.length > 0 ? obstacle.actions.map((action, aIdx) => (
            <tr
              key={action.id}
              className={cn("border-b border-border transition-colors", getRowBg(action))}
            >
              {/* Pillar cell - only on first action of first obstacle */}
              {aIdx === 0 && obstacleIdx === 0 ? (
                <PillarCell pillar={pillar} pillarIdx={pillarIdx} onUpdate={onUpdatePillar} />
              ) : aIdx === 0 ? null : null}
              {aIdx !== 0 && obstacleIdx === 0 && <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />}
              {aIdx !== 0 && obstacleIdx !== 0 && <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />}

              {/* Obstacle cell - only on first action */}
              {aIdx === 0 ? (
                <td className="border-r border-border px-2 py-1.5 align-top" rowSpan={actionCount + 1}>
                  <span className="text-xs font-bold text-primary">{obstacle.code}</span>
                  <InlineText
                    value={obstacle.description ?? ""}
                    onSave={(v) => onUpdateObstacle(obstacle.id, "description", v)}
                    placeholder="Clique para definir"
                    className="text-xs block mt-0.5"
                  />
                </td>
              ) : null}

              {/* Action cells */}
              <ActionCells action={action} pillarIdx={pillarIdx} onUpdateAction={onUpdateAction} />
            </tr>
          )) : (
            /* Empty obstacle - no actions */
            <tr className="border-b border-border">
              {obstacleIdx === 0 ? (
                <PillarCell pillar={pillar} pillarIdx={pillarIdx} onUpdate={onUpdatePillar} />
              ) : (
                <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />
              )}
              <td className="border-r border-border px-2 py-1.5 align-top">
                <span className="text-xs font-bold text-primary">{obstacle.code}</span>
                <InlineText
                  value={obstacle.description ?? ""}
                  onSave={(v) => onUpdateObstacle(obstacle.id, "description", v)}
                  placeholder="Clique para definir"
                  className="text-xs block mt-0.5"
                />
              </td>
              <td colSpan={6} className="px-2 py-1.5">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onAddAction}>
                  <Plus className="h-3 w-3" /> Ação
                </Button>
              </td>
            </tr>
          )}
        </SortableContext>
      </DndContext>

      {/* Add action row */}
      {obstacle.actions.length > 0 && (
        <tr className="border-b border-border">
          <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />
          <td className="border-r border-border" />
          <td colSpan={6} className="px-2 py-1">
            {newAction ? (
              <InlineText
                value=""
                onSave={(v) => addAction(obstacle.id, v)}
                placeholder="Descrição da ação..."
                autoFocus
                className="text-xs"
              />
            ) : (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onAddAction}>
                <Plus className="h-3 w-3" /> Ação
              </Button>
            )}
          </td>
        </tr>
      )}

      {/* Add obstacle row (after last obstacle) */}
      {isLastObstacle && (
        <tr className="border-b-2 border-border">
          <td className={cn("border-r border-border border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])} />
          <td colSpan={7} className="px-2 py-1">
            {newObstacle ? (
              <InlineText
                value=""
                onSave={(v) => addObstacle(pillar.id, v)}
                placeholder="Código (ex: 1.5)..."
                autoFocus
                className="text-xs"
              />
            ) : (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onAddObstacle}>
                <Plus className="h-3 w-3" /> Obstáculo
              </Button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function PillarCell({ pillar, pillarIdx, onUpdate }: { pillar: Pillar; pillarIdx: number; onUpdate: (id: string, name: string) => Promise<void> }) {
  const totalActions = pillar.obstacles.reduce((s, o) => s + o.actions.length, 0);
  const totalRows = totalActions + pillar.obstacles.length + pillar.obstacles.length + 1; // actions + add-action rows + add-obstacle row

  return (
    <td
      className={cn("border-r border-border px-2 py-2 align-top border-l-4", PILLAR_BORDER_COLORS[pillarIdx % 6])}
      rowSpan={totalRows}
    >
      <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Pilar {pillar.number}</span>
      <InlineText
        value={pillar.name}
        onSave={(v) => onUpdate(pillar.id, v)}
        className="text-xs font-semibold block mt-0.5"
      />
    </td>
  );
}

function ActionCells({ action, pillarIdx, onUpdateAction }: { action: Action; pillarIdx: number; onUpdateAction: (id: string, field: string, value: any) => Promise<void> }) {
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";

  return (
    <>
      <td className="border-r border-border px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusDot(action))} />
          <InlineText
            value={action.description}
            onSave={(v) => onUpdateAction(action.id, "description", v)}
            className="text-xs"
          />
        </div>
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdateAction(action.id, "expected_result", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdateAction(action.id, "deliverable", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <InlineText
          value={action.responsible ?? ""}
          onSave={(v) => onUpdateAction(action.id, "responsible", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="border-r border-border px-2 py-1.5">
        <DeadlineInline
          deadline={action.deadline}
          isOverdue={isOverdue}
          onSave={(v) => onUpdateAction(action.id, "deadline", v)}
        />
      </td>
      <td className="px-2 py-1.5">
        <StatusSelect action={action} onSave={(v) => onUpdateAction(action.id, "status", v)} />
      </td>
    </>
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
        className={cn(
          "bg-transparent text-xs border-none focus:outline-none focus:ring-0 cursor-pointer w-full",
          isOverdue && "text-destructive font-medium"
        )}
      />
    </div>
  );
}
