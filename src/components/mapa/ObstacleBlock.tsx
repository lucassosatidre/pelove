import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { RichInlineText } from "./RichInlineText";
import { SortableActionRow, ACTION_COLS } from "./ActionRow";
import { Button } from "@/components/ui/button";
import type { Obstacle } from "@/hooks/useStrategicData";
import { supabase } from "@/integrations/supabase/client";

interface ObstacleBlockProps {
  obstacle: Obstacle;
  onUpdate: (id: string, field: string, value: string) => Promise<void>;
  onUpdateAction: (id: string, field: string, value: any) => Promise<void>;
  onAddAction: (obstacleId: string, desc: string) => Promise<void>;
  invalidate: () => void;
  newAction: boolean;
  onToggleNewAction: () => void;
}

export function SortableObstacleBlock({ obstacle, onUpdate, onUpdateAction, onAddAction, invalidate, newAction, onToggleNewAction }: ObstacleBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obstacle.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleActionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = obstacle.actions.findIndex(a => a.id === active.id);
    const newIdx = obstacle.actions.findIndex(a => a.id === over.id);
    const reordered = arrayMove(obstacle.actions, oldIdx, newIdx);
    await Promise.all(reordered.map((a, i) => supabase.from("actions").update({ execution_order: i + 1 }).eq("id", a.id)));
    invalidate();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex border-b border-border", isDragging && "opacity-50 shadow-lg z-10 relative bg-background")}
    >
      {/* Obstacle cell */}
      <div className="border-r border-border px-2 py-1.5 flex-shrink-0" style={{ width: 180, minWidth: 180 }}>
        <div className="flex items-start gap-1">
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1">
            <RichInlineText
              value={obstacle.description ?? ""}
              onSave={(v) => onUpdate(obstacle.id, "description", v)}
              placeholder="Clique para definir"
              className="text-xs block"
            />
          </div>
        </div>
      </div>

      {/* Actions area */}
      <div className="flex-1 min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActionDragEnd}>
          <SortableContext items={obstacle.actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {obstacle.actions.length > 0 ? (
              obstacle.actions.map(action => (
                <SortableActionRow key={action.id} action={action} onUpdate={onUpdateAction} />
              ))
            ) : (
              <div className="grid border-b border-border" style={{ gridTemplateColumns: ACTION_COLS }}>
                <div className="px-2 py-1.5 text-xs text-muted-foreground italic col-span-6">
                  Nenhuma ação
                </div>
              </div>
            )}
          </SortableContext>
        </DndContext>

        {/* Add action */}
        <div className="px-2 py-1">
          {newAction ? (
            <InlineText value="" onSave={(v) => onAddAction(obstacle.id, v)} placeholder="Descrição da ação..." autoFocus className="text-xs" />
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 gap-1" onClick={onToggleNewAction}>
              <Plus className="h-3 w-3" /> Ação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
