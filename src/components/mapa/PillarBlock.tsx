import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { RichInlineText } from "./RichInlineText";
import { SortableObstacleBlock } from "./ObstacleBlock";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Pillar } from "@/hooks/useStrategicData";
import { PILLAR_COLORS } from "@/hooks/useStrategicData";

interface PillarBlockProps {
  pillar: Pillar;
  pillarIdx: number;
  onUpdatePillar: (id: string, name: string) => Promise<void>;
  onUpdateObstacle: (id: string, field: string, value: string) => Promise<void>;
  onUpdateAction: (id: string, field: string, value: any) => Promise<void>;
  onAddObstacle: (pillarId: string, code: string) => Promise<void>;
  onAddAction: (obstacleId: string, desc: string) => Promise<void>;
  invalidate: () => void;
}

export function SortablePillarBlock({
  pillar, pillarIdx, onUpdatePillar, onUpdateObstacle, onUpdateAction,
  onAddObstacle, onAddAction, invalidate,
}: PillarBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pillar.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const borderColor = PILLAR_COLORS[pillarIdx % 6];

  const [newObstacle, setNewObstacle] = useState(false);
  const [newActions, setNewActions] = useState<Record<string, boolean>>({});

  const handleObstacleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pillar.obstacles.findIndex(o => o.id === active.id);
    const newIdx = pillar.obstacles.findIndex(o => o.id === over.id);
    const reordered = arrayMove(pillar.obstacles, oldIdx, newIdx);
    await Promise.all(reordered.map((o, i) => supabase.from("obstacles").update({ display_order: i + 1 }).eq("id", o.id)));
    invalidate();
  };

  const handleAddObstacle = async (code: string) => {
    if (!code.trim()) { setNewObstacle(false); return; }
    await onAddObstacle(pillar.id, code);
    setNewObstacle(false);
  };

  const handleAddAction = async (obstacleId: string, desc: string) => {
    if (!desc.trim()) { setNewActions(p => ({ ...p, [obstacleId]: false })); return; }
    await onAddAction(obstacleId, desc);
    setNewActions(p => ({ ...p, [obstacleId]: false }));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex border-b-2 border-border", isDragging && "opacity-50 shadow-lg z-10 relative bg-background")}
    >
      {/* Pillar cell */}
      <div className={cn("border-r border-border px-2 py-2 flex-shrink-0 border-l-4", borderColor)} style={{ width: 150, minWidth: 150 }}>
        <div className="flex items-start gap-1">
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1">
            <RichInlineText value={pillar.name} onSave={(v) => onUpdatePillar(pillar.id, v)} className="text-xs font-semibold block" />
          </div>
        </div>
      </div>

      {/* Obstacles area */}
      <div className="flex-1 min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleObstacleDragEnd}>
          <SortableContext items={pillar.obstacles.filter(o => o.description || o.actions.length > 0).map(o => o.id)} strategy={verticalListSortingStrategy}>
            {pillar.obstacles.filter(o => o.description || o.actions.length > 0).map(obstacle => (
              <SortableObstacleBlock
                key={obstacle.id}
                obstacle={obstacle}
                onUpdate={onUpdateObstacle}
                onUpdateAction={onUpdateAction}
                onAddAction={handleAddAction}
                invalidate={invalidate}
                newAction={!!newActions[obstacle.id]}
                onToggleNewAction={() => setNewActions(p => ({ ...p, [obstacle.id]: true }))}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add obstacle */}
        <div className="px-2 py-1">
          {newObstacle ? (
            <InlineText value="" onSave={handleAddObstacle} placeholder="Código (ex: 1.5)..." autoFocus className="text-xs" />
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={() => setNewObstacle(true)}>
              <Plus className="h-3 w-3" /> Obstáculo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
