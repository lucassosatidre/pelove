import { useState } from "react";
import { cn } from "@/lib/utils";
import { getComputedStatus } from "@/hooks/useStrategicData";
import type { Action, ActionStatus } from "@/hooks/useStrategicData";

const STATUS_OPTIONS: { value: ActionStatus; label: string }[] = [
  { value: "agendado", label: "Agendado" },
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

const DOT_COLORS: Record<string, string> = {
  agendado: "bg-[hsl(var(--status-scheduled))]",
  nao_iniciado: "bg-[hsl(var(--status-not-started))]",
  em_andamento: "bg-[hsl(var(--status-in-progress))]",
  concluido: "bg-[hsl(var(--status-completed))]",
  atrasado: "bg-[hsl(var(--status-overdue))]",
};

interface StatusSelectProps {
  action: Action;
  onSave: (status: ActionStatus) => Promise<void>;
}

export function StatusSelect({ action, onSave }: StatusSelectProps) {
  const [flash, setFlash] = useState(false);
  const computed = getComputedStatus(action);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ActionStatus;
    await onSave(val);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };

  return (
    <div className={cn("flex items-center gap-1.5 transition-colors duration-300", flash && "bg-green-100 rounded")}>
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT_COLORS[computed])} />
      <select
        value={action.status}
        onChange={handleChange}
        className="bg-transparent text-xs border-none focus:outline-none focus:ring-0 cursor-pointer"
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

export function getRowBg(action: Action): string {
  const cs = getComputedStatus(action);
  switch (cs) {
    case "agendado": return "bg-blue-50";
    case "nao_iniciado": return "bg-gray-50";
    case "em_andamento": return "bg-orange-50";
    case "concluido": return "bg-green-50";
    case "atrasado": return "bg-red-50";
    default: return "";
  }
}

export function getStatusDot(action: Action): string {
  return DOT_COLORS[getComputedStatus(action)] ?? "";
}
