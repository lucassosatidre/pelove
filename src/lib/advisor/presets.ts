// Presets de modelos e tipos de agente do Advisor.
// Os mesmos IDs precisam ser reconhecidos na edge function advisor-chat
// (em supabase/functions/_shared/agents.ts).

export interface ModelPreset {
  id: string;
  label: string;
  hint: string;
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    hint: "Rápido — uso diário",
  },
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    hint: "Reflexão profunda — decisões",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    hint: "Bem rápido — perguntas curtas",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export interface AgentPreset {
  id: string;
  label: string;
  description: string;
  emoji?: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "conselheiro",
    label: "Conselheiro",
    description: "Visão completa: estratégia + operação + números",
    emoji: "🧭",
  },
  {
    id: "estrategico",
    label: "Estratégico",
    description: "Foco no mapa, pilares, prioridades de longo prazo",
    emoji: "🎯",
  },
  {
    id: "operacional",
    label: "Operacional",
    description: "Dia-a-dia: vendas, produção, cancelamentos, equipe",
    emoji: "⚙️",
  },
  {
    id: "analista",
    label: "Analista",
    description: "Números, comparativos, drill-down de dados",
    emoji: "📊",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Foco na DRE, custos, margens, fluxo",
    emoji: "💰",
  },
];

export const DEFAULT_AGENT_ID = "conselheiro";

const MODEL_KEY = "pelove.advisor.model";
const AGENT_KEY = "pelove.advisor.agent";

export function loadModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL_ID;
}

export function saveModel(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_KEY, id);
}

export function loadAgent(): string {
  if (typeof window === "undefined") return DEFAULT_AGENT_ID;
  return localStorage.getItem(AGENT_KEY) || DEFAULT_AGENT_ID;
}

export function saveAgent(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_KEY, id);
}
