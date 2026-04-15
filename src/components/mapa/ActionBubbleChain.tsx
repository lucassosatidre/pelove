import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichInlineText } from "./RichInlineText";
import { StatusSelect } from "./StatusSelect";
import { getComputedStatus, type Action } from "@/hooks/useStrategicData";

function ResponsibleBubbleContent({ value, onSave }: { value: string | null; onSave: (v: string | null) => Promise<void> }) {
  const names = (value ?? "").split(",").map(n => n.trim()).filter(Boolean);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const remove = async (idx: number) => {
    const updated = names.filter((_, i) => i !== idx);
    await onSave(updated.length ? updated.join(", ") : null);
  };

  const add = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setAdding(false); return; }
    const updated = [...names, trimmed];
    await onSave(updated.join(", "));
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 max-h-[80px] overflow-y-auto">
      {names.map((name, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 bg-muted text-foreground rounded-full px-2 py-0.5 text-[10px]">
          {name}
          <button onClick={() => remove(i)} className="hover:text-destructive ml-0.5">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
          onBlur={add}
          className="bg-transparent border border-primary/30 rounded px-1 py-0.5 text-[10px] w-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Nome..."
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-5 w-5 rounded-full border border-dashed border-muted-foreground flex items-center justify-center hover:bg-accent transition-colors"
          title="Adicionar responsável"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

const BUBBLE_WIDTHS: Record<string, string> = {
  action: "w-[200px]",
  expected: "w-[200px]",
  deliverable: "w-[200px]",
  responsible: "w-[160px]",
  deadline: "w-[140px]",
  status: "w-[140px]",
};

function DeadlineInput({ deadline, isOverdue, onSave }: { deadline: string | null; isOverdue: boolean; onSave: (v: string | null) => Promise<void> }) {
  const [flash, setFlash] = useState(false);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await onSave(e.target.value || null);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };
  return (
    <div className={cn("transition-colors duration-300 rounded flex items-center gap-1", flash && "bg-green-100")}>
      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
      <input
        type="date"
        value={deadline ?? ""}
        onChange={handleChange}
        className={cn("bg-transparent text-[11px] border-none focus:outline-none focus:ring-0 cursor-pointer w-full", isOverdue && "text-destructive font-medium")}
      />
    </div>
  );
}

function Bubble({ label, children, className, width, borderColor, style: extraStyle }: {
  label: string; children: React.ReactNode; className?: string; width?: string; borderColor?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border p-2 min-h-[80px] shrink-0 flex flex-col",
        borderColor && "border-l-4",
        width,
        className
      )}
      style={{
        ...(borderColor ? { borderLeftColor: borderColor } : {}),
        ...extraStyle,
      }}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">{label}</span>
      <div className="text-xs flex-1">{children}</div>
    </div>
  );
}

function BubbleConnector({ color }: { color?: string }) {
  return (
    <svg width="24" height="20" className="shrink-0 self-center" viewBox="0 0 24 20">
      <path d="M0,10 C8,10 16,10 24,10" fill="none" stroke={color || "hsl(var(--border))"} strokeWidth="2" />
    </svg>
  );
}

interface ActionBubbleChainProps {
  action: Action;
  obstacleId: string;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
  pillarColor?: string | null;
}

export function ActionBubbleChain({ action, obstacleId, onUpdate, pillarColor }: ActionBubbleChainProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cs = getComputedStatus(action);
  const isOverdue = cs === "atrasado";
  const bc = pillarColor ?? undefined;

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

      <Bubble label="Ação" width={BUBBLE_WIDTHS.action} borderColor={bc}>
        <RichInlineText value={action.description} onSave={(v) => onUpdate(action.id, "description", v)} className={cn("text-xs font-semibold", action.is_bold && "font-black")} />
      </Bubble>

      <BubbleConnector color={bc} />

      <Bubble label="Resultado esperado" width={BUBBLE_WIDTHS.expected} borderColor={bc}>
        <RichInlineText
          value={action.expected_result ?? ""}
          onSave={(v) => onUpdate(action.id, "expected_result", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector color={bc} />

      <Bubble label="Entregável" width={BUBBLE_WIDTHS.deliverable} borderColor={bc}>
        <RichInlineText
          value={action.deliverable ?? ""}
          onSave={(v) => onUpdate(action.id, "deliverable", v || null)}
          placeholder="—"
          className="text-xs"
        />
      </Bubble>

      <BubbleConnector color={bc} />

      <Bubble label="Responsável" width={BUBBLE_WIDTHS.responsible} borderColor={bc}>
        <ResponsibleBubbleContent value={action.responsible} onSave={(v) => onUpdate(action.id, "responsible", v)} />
      </Bubble>

      <BubbleConnector color={bc} />

      <Bubble label="Prazo" width={BUBBLE_WIDTHS.deadline} borderColor={bc}>
        <DeadlineInput deadline={action.deadline} isOverdue={isOverdue} onSave={(v) => onUpdate(action.id, "deadline", v)} />
      </Bubble>

      <BubbleConnector color={bc} />

      <Bubble label="Status" width={BUBBLE_WIDTHS.status}>
        <StatusSelect action={action} onSave={(v) => onUpdate(action.id, "status", v)} />
      </Bubble>
    </div>
  );
}
