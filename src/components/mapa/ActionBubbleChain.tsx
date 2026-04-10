import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { StatusSelect } from "./StatusSelect";
import { getComputedStatus, type Action } from "@/hooks/useStrategicData";

const BUBBLE_WIDTHS: Record<string, string> = {
  action: "w-[200px]",
  expected: "w-[220px]",
  deliverable: "w-[220px]",
  responsible: "w-[200px]",
  status: "w-[150px]",
};

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
        className={cn("bg-transparent text-[11px] border-none focus:outline-none focus:ring-0 cursor-pointer w-full", isOverdue && "text-destructive font-medium")}
      />
    </div>
  );
}

function Bubble({ label, children, className, borderColor, width }: {
  label: string; children: React.ReactNode; className?: string; borderColor?: string; width?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border p-2 min-h-[80px] shrink-0 flex flex-col",
        borderColor && "border-l-4",
        width,
        className
      )}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">{label}</span>
      <div className="text-xs flex-1">{children}</div>
    </div>
  );
}

function BubbleConnector() {
  return (
    <svg width="24" height="20" className="shrink-0 self-center" viewBox="0 0 24 20">
      <path d="M0,10 C8,10 16,10 24,10" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
    </svg>
  );
}

interface ActionBubbleChainProps {
  action: Action;
  obstacleId: string;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
}

export function ActionBubbleChain({ action, obstacleId, onUpdate }: ActionBubbleChainProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";
  const isScheduled = action.status === "agendado";
  const deadlineLabel = isScheduled ? "Responsável | Agendado" : "Responsável | Prazo";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch gap-0",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="action"
      data-id={action.id}
      data-obstacle={obstacleId}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mr-1 self-center">
        <GripVertical className="h-3 w-3" />
      </button>

      <Bubble label="Ação" borderColor="hsl(var(--primary))" width={BUBBLE_WIDTHS.action}>
        <InlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className="text-xs font-semibold" />
      </Bubble>

      <BubbleConnector />

      <Bubble label="Resultado esperado" width={BUBBLE_WIDTHS.expected}>
        <InlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdate(action.id, "expected_result", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector />

      <Bubble label="Entregável" width={BUBBLE_WIDTHS.deliverable}>
        <InlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdate(action.id, "deliverable", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector />

      <Bubble label={deadlineLabel} width={BUBBLE_WIDTHS.responsible}>
        <div className="flex flex-col gap-1">
          <InlineText
            value={action.responsible ?? ""}
            onSave={(v) => onUpdate(action.id, "responsible", v || null)}
            placeholder="—"
            className="text-xs"
          />
          <DeadlineInput deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
        </div>
      </Bubble>

      <BubbleConnector />

      <Bubble label="Status" width={BUBBLE_WIDTHS.status}>
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </Bubble>
    </div>
  );
}
