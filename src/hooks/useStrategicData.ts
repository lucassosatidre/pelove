import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActionStatus = "agendado" | "nao_iniciado" | "em_andamento" | "concluido";

export interface Action {
  id: string;
  obstacle_id: string;
  description: string;
  area: string | null;
  expected_result: string | null;
  deliverable: string | null;
  responsible: string | null;
  deadline: string | null;
  status: ActionStatus;
  importance: number | null;
  urgency: number | null;
  reliability: number | null;
  priority_score: number | null;
  execution_order: number | null;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
}

export interface Obstacle {
  id: string;
  pillar_id: string;
  code: string;
  description: string | null;
  display_order: number;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
  actions: Action[];
}

export interface Pillar {
  id: string;
  number: number;
  name: string;
  display_order: number;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
  obstacles: Obstacle[];
}

export interface Vision {
  id: string;
  text: string;
  reference_year: number;
}

export function useVision() {
  return useQuery({
    queryKey: ["vision"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vision").select("*").limit(1).single();
      if (error) throw error;
      return data as Vision;
    },
  });
}

export function useStrategicMap() {
  return useQuery({
    queryKey: ["strategic-map"],
    queryFn: async () => {
      const { data: pillars, error: pe } = await supabase
        .from("pillars")
        .select("*")
        .order("display_order");
      if (pe) throw pe;

      const { data: obstacles, error: oe } = await supabase
        .from("obstacles")
        .select("*")
        .order("display_order");
      if (oe) throw oe;

      const { data: actions, error: ae } = await supabase
        .from("actions")
        .select("*")
        .order("execution_order");
      if (ae) throw ae;

      const obstaclesMap = new Map<string, Obstacle>();
      for (const o of obstacles ?? []) {
        obstaclesMap.set(o.id, { ...o, actions: [] } as Obstacle);
      }

      for (const a of actions ?? []) {
        const obs = obstaclesMap.get(a.obstacle_id);
        if (obs) obs.actions.push(a as Action);
      }

      const result: Pillar[] = (pillars ?? []).map((p) => ({
        ...p,
        obstacles: (obstacles ?? [])
          .filter((o) => o.pillar_id === p.id)
          .map((o) => obstaclesMap.get(o.id)!),
      })) as Pillar[];

      return result;
    },
  });
}

export function getComputedStatus(action: Action): string {
  const today = new Date().toISOString().split("T")[0];
  const status = action.status as string;
  if (status === "concluido") return "concluido";
  if (action.deadline && action.deadline < today && status !== "concluido") return "atrasado";
  if (status === "em_andamento") return "em_andamento";
  if (status === "agendado" || (action.deadline && action.deadline > today && status === "nao_iniciado")) return "agendado";
  return "nao_iniciado";
}

export const STATUS_CONFIG: Record<string, { label: string; colorClass: string }> = {
  agendado: { label: "Agendado", colorClass: "bg-status-scheduled text-primary-foreground" },
  nao_iniciado: { label: "Não iniciado", colorClass: "bg-status-not-started text-primary-foreground" },
  em_andamento: { label: "Em andamento", colorClass: "bg-status-in-progress text-primary-foreground" },
  concluido: { label: "Concluído", colorClass: "bg-status-completed text-primary-foreground" },
  atrasado: { label: "Atrasado", colorClass: "bg-status-overdue text-primary-foreground" },
};

export const PILLAR_COLORS = [
  "border-l-[hsl(var(--pillar-1))]",
  "border-l-[hsl(var(--pillar-2))]",
  "border-l-[hsl(var(--pillar-3))]",
  "border-l-[hsl(var(--pillar-4))]",
  "border-l-[hsl(var(--pillar-5))]",
  "border-l-[hsl(var(--pillar-6))]",
];

export const AREA_OPTIONS = [
  "Iniciativas Estratégicas",
  "Financeiro/Contábil",
  "Dados/Tecnologia",
  "Governança",
  "Comercial",
  "Processos/Operação",
  "Pessoas",
  "Marketing",
];
