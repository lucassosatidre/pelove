import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText } from "./InlineText";
import { StatusSelect, getRowBg } from "./StatusSelect";
import { getComputedStatus, STATUS_CONFIG, type Action } from "@/hooks/useStrategicData";

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

function Bubble({ label, children, className, borderColor }: { label: string; children: React.ReactNode; className?: string; borderColor?: string }) {
  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border p-2 min-w-[80px] max-w-[220px] shrink-0",
        borderColor && "border-l-4",
        className
      )}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium block mb-0.5">{label}</span>
      <div className="text-xs">{children}</div>
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

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-0",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="action"
      data-id={action.id}
      data-obstacle={obstacleId}
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mr-1">
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Bubble 1: Título */}
      <Bubble label="Ação" borderColor="hsl(var(--primary))">
        <InlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className="text-xs font-semibold" />
      </Bubble>

      <BubbleConnector />

      {/* Bubble 2: Resultado esperado */}
      <Bubble label="Resultado esperado">
        <InlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdate(action.id, "expected_result", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector />

      {/* Bubble 3: Entregável */}
      <Bubble label="Entregável">
        <InlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdate(action.id, "deliverable", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector />

      {/* Bubble 4: Responsável + Prazo */}
      <Bubble label="Responsável | Prazo">
        <div className="flex items-center gap-1.5">
          <InlineText
            value={action.responsible ?? ""}
            onSave={(v) => onUpdate(action.id, "responsible", v || null)}
            placeholder="—"
            className="text-xs"
          />
          <span className="text-muted-foreground text-[10px]">|</span>
          <DeadlineInput deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
        </div>
      </Bubble>

      <BubbleConnector />

      {/* Bubble 5: Status */}
      <Bubble label="Status" className={getRowBg(action)}>
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </Bubble>
    </div>
  );
}
