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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  agendado: { bg: "bg-[#3B82F6]", text: "text-white" },
  nao_iniciado: { bg: "bg-[#6B7280]", text: "text-white" },
  em_andamento: { bg: "bg-[#F97316]", text: "text-white" },
  concluido: { bg: "bg-[#22C55E]", text: "text-white" },
  atrasado: { bg: "bg-[#EF4444]", text: "text-white" },
};

interface StatusSelectProps {
  action: Action;
  onSave: (status: ActionStatus) => Promise<void>;
}

export function StatusSelect({ action, onSave }: StatusSelectProps) {
  const [flash, setFlash] = useState(false);
  const computed = getComputedStatus(action);
  const colors = STATUS_COLORS[computed] ?? STATUS_COLORS.nao_iniciado;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ActionStatus;
    await onSave(val);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  };

  return (
    <div className={cn("flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors duration-300", colors.bg, flash && "ring-2 ring-green-400")}>
      <select
        value={action.status}
        onChange={handleChange}
        className={cn("bg-transparent text-xs border-none focus:outline-none focus:ring-0 cursor-pointer", colors.text)}
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s.value} value={s.value} className="bg-card text-foreground">{s.label}</option>
        ))}
      </select>
    </div>
  );
}

export function getRowBg(action: Action): string {
  const cs = getComputedStatus(action);
  const colors = STATUS_COLORS[cs];
  return colors ? colors.bg : "";
}

export function getStatusDot(_action: Action): string {
  return "";
}
