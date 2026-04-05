import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { StatusSelect, getRowBg, getStatusDot } from "./StatusSelect";
import { getComputedStatus, type Action } from "@/hooks/useStrategicData";

const ACTION_COLS = "minmax(250px,1fr) minmax(200px,1fr) minmax(220px,1fr) 120px 110px 120px";

function DeadlineInline({ deadline, isOverdue, onSave }: { deadline: string | null; isOverdue: boolean; onSave: (v: string | null) => Promise<void> }) {
  const [flash, setFlash] = useState(false);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await onSave(e.target.value || null);
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

interface ActionRowProps {
  action: Action;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
}

export function SortableActionRow({ action, onUpdate }: ActionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";
  const bg = getRowBg(action);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("grid border-b border-border", isDragging && "opacity-50 shadow-lg z-10 relative", bg)}
      style={{ ...style, gridTemplateColumns: ACTION_COLS }}
    >
      {/* Ação */}
      <div className="border-r border-border px-2 py-1.5 flex items-center gap-1.5">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusDot(action))} />
        <InlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className="text-xs" />
      </div>
      {/* Resultado */}
      <div className="border-r border-border px-2 py-1.5">
        <InlineText value={action.expected_result ?? ""} onSave={(v) => onUpdate(action.id, "expected_result", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Entregável */}
      <div className="border-r border-border px-2 py-1.5">
        <InlineText value={action.deliverable ?? ""} onSave={(v) => onUpdate(action.id, "deliverable", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Responsável */}
      <div className="border-r border-border px-2 py-1.5">
        <InlineText value={action.responsible ?? ""} onSave={(v) => onUpdate(action.id, "responsible", v || null)} placeholder="—" className="text-xs" />
      </div>
      {/* Prazo */}
      <div className="border-r border-border px-2 py-1.5">
        <DeadlineInline deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
      </div>
      {/* Status */}
      <div className="px-2 py-1.5">
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </div>
    </div>
  );
}

export { ACTION_COLS };
