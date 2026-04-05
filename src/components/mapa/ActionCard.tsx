import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { StatusSelect, getRowBg } from "./StatusSelect";
import { getComputedStatus, type Action } from "@/hooks/useStrategicData";

interface ActionCardProps {
  action: Action;
  obstacleId: string;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
}

function DeadlineInput({ deadline, isOverdue, onSave }: { deadline: string | null; isOverdue: boolean; onSave: (v: string | null) => Promise<void> }) {
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
        className={cn("bg-transparent text-[10px] border-none focus:outline-none focus:ring-0 cursor-pointer w-full", isOverdue && "text-destructive font-medium")}
      />
    </div>
  );
}

export function ActionCard({ action, obstacleId, onUpdate }: ActionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";
  const bg = getRowBg(action);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border p-2.5 min-w-[280px] max-w-[320px] shadow-sm",
        bg,
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="action"
      data-id={action.id}
      data-obstacle={obstacleId}
    >
      {/* Line 1: drag + description */}
      <div className="flex items-start gap-1 mb-1">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
          <GripVertical className="h-3 w-3" />
        </button>
        <InlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className="text-xs font-medium" />
      </div>

      {/* Line 2: expected result */}
      <div className="pl-4 mb-0.5">
        <InlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdate(action.id, "expected_result", v || null)}
          placeholder="Resultado esperado"
          className="text-[10px] text-muted-foreground"
        />
      </div>

      {/* Line 3: deliverable */}
      <div className="pl-4 mb-1">
        <InlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdate(action.id, "deliverable", v || null)}
          placeholder="Entregável"
          className="text-[10px] text-muted-foreground"
        />
      </div>

      {/* Line 4: responsible | deadline | status */}
      <div className="pl-4 flex items-center gap-2 flex-wrap">
        <InlineText
          value={action.responsible ?? ""}
          onSave={(v) => onUpdate(action.id, "responsible", v || null)}
          placeholder="Resp."
          className="text-[10px] text-muted-foreground"
        />
        <span className="text-muted-foreground text-[10px]">|</span>
        <DeadlineInput deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
        <span className="text-muted-foreground text-[10px]">|</span>
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </div>
    </div>
  );
}
