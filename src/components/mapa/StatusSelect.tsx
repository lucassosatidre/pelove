import { useState } from "react";
import { cn } from "@/lib/utils";
import { getComputedStatus } from "@/hooks/useStrategicData";
import { useCustomStatuses, useCreateCustomStatus, type CustomStatus } from "@/hooks/useCustomStatuses";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown, Plus, Check } from "lucide-react";
import type { Action } from "@/hooks/useStrategicData";

const FALLBACK_STATUSES: CustomStatus[] = [
  { id: "1", value: "agendado", label: "Agendado", color: "#3B82F6", display_order: 1, is_default: true },
  { id: "2", value: "nao_iniciado", label: "Não iniciado", color: "#6B7280", display_order: 2, is_default: true },
  { id: "3", value: "em_andamento", label: "Em andamento", color: "#F97316", display_order: 3, is_default: true },
  { id: "4", value: "concluido", label: "Concluído", color: "#22C55E", display_order: 4, is_default: true },
];

const OVERDUE_COLOR = "#EF4444";

const SWATCH_COLORS = [
  "#3B82F6", "#6B7280", "#F97316", "#22C55E",
  "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6",
  "#F59E0B", "#6366F1",
];

interface StatusSelectProps {
  action: Action;
  onSave: (status: string) => Promise<void>;
}

export function StatusSelect({ action, onSave }: StatusSelectProps) {
  const { data: statuses } = useCustomStatuses();
  const createStatus = useCreateCustomStatus();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(SWATCH_COLORS[4]);
  const [flash, setFlash] = useState(false);

  const allStatuses = statuses?.length ? statuses : FALLBACK_STATUSES;
  const computed = getComputedStatus(action);
  const isOverdue = computed === "atrasado";

  const currentStatus = allStatuses.find(s => s.value === action.status);
  const displayColor = isOverdue ? OVERDUE_COLOR : (currentStatus?.color ?? "#6B7280");
  const displayLabel = isOverdue ? "Atrasado" : (currentStatus?.label ?? action.status);

  const handleSelect = async (value: string) => {
    await onSave(value);
    setOpen(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };

  const handleCreate = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    try {
      const created = await createStatus.mutateAsync({ label: trimmed, color: newColor });
      await onSave(created.value);
      setCreating(false);
      setNewLabel("");
      setOpen(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    } catch (e) {
      console.error("Error creating status:", e);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white transition-colors duration-300 w-full",
            flash && "ring-2 ring-green-400"
          )}
          style={{ backgroundColor: displayColor }}
        >
          <span className="truncate flex-1 text-left">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start" sideOffset={4}>
        <div className="flex flex-col gap-0.5">
          {allStatuses.map(s => (
            <button
              key={s.value}
              onClick={() => handleSelect(s.value)}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors w-full text-left"
            >
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate">{s.label}</span>
              {action.status === s.value && <Check className="h-3 w-3 text-primary shrink-0" />}
            </button>
          ))}

          {isOverdue && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: OVERDUE_COLOR }} />
              <span>Atrasado (automático)</span>
            </div>
          )}

          <div className="border-t border-border my-1" />

          {creating ? (
            <div className="p-2 space-y-2">
              <input
                autoFocus
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Nome do status..."
                className="w-full bg-transparent border border-input rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-wrap gap-1">
                {SWATCH_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("h-5 w-5 rounded-full border-2 transition-transform", newColor === c ? "border-primary scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground rounded px-2 py-1 text-xs hover:bg-primary/90">
                  Criar
                </button>
                <button onClick={() => setCreating(false)} className="flex-1 bg-muted text-muted-foreground rounded px-2 py-1 text-xs hover:bg-muted/80">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors w-full text-left text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>Novo status</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function getRowBg(action: Action): string {
  return "";
}

export function getStatusDot(_action: Action): string {
  return "";
}
