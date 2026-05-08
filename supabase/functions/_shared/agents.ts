// Tipos de agente (presets de foco). Cada preset adiciona uma seção
// específica ao system prompt orientando o tom/foco da resposta.
//
// Os IDs aqui devem bater com os de src/lib/advisor/presets.ts no front.

export type AgentId =
  | "conselheiro"
  | "estrategico"
  | "operacional"
  | "analista"
  | "financeiro";

export const DEFAULT_AGENT: AgentId = "conselheiro";

export function isAgentId(s: unknown): s is AgentId {
  return s === "conselheiro" || s === "estrategico" || s === "operacional"
    || s === "analista" || s === "financeiro";
}

export function agentFocusPrompt(agent: AgentId): string {
  switch (agent) {
    case "estrategico":
      return `\n=== MODO: ESTRATÉGICO ===
Foco em: visão de longo prazo, pilares do mapa, prioridades, sequenciamento de ações, decisões estruturais.
Quando responder, sempre amarre a um pilar/obstáculo do mapa. Evite mergulhar em métricas operacionais detalhadas a menos que peça.
Pergunte "qual o resultado esperado disso pra Estrela em 12 meses?" antes de sugerir ação grande.`;
    case "operacional":
      return `\n=== MODO: OPERACIONAL ===
Foco em: dia-a-dia da loja — vendas semanais, produção, cancelamentos, tempos de cozinha, equipe.
Use bastante as tools de get_sales_*, get_status_avg_times, get_cancellations.
Mostre dados do dia/semana atual. Se aparecer pico ou queda anormal, alerta direto.`;
    case "analista":
      return `\n=== MODO: ANALISTA ===
Foco em: cruzar números. Sempre traga comparativos (vs período anterior, vs ano anterior).
Use tools agressivamente — não chute valores. Estruture respostas em tabelas curtas (formato markdown ok).
Se faltar dado, diga exatamente qual data/granularidade falta.`;
    case "financeiro":
      return `\n=== MODO: FINANCEIRO ===
Foco em: DRE, custos, margens, fluxo de caixa, taxa efetiva. Compare com mês anterior e mesmo mês ano anterior.
Quando o usuário falar de despesa, classifique em CMV / Pessoal / Operacional / Marketing / Outros.
Lembre de IFOOD/Maquinona como custos relevantes.`;
    case "conselheiro":
    default:
      return `\n=== MODO: CONSELHEIRO ===
Visão completa: combina estratégia + operação + números. Padrão.
Use tools quando precisar de número exato. Conecte cada sugestão ao mapa.`;
  }
}

export function routeContextPrompt(route: string | null | undefined): string {
  if (!route) return "";
  const r = route.split("?")[0];
  if (r.startsWith("/mapa")) {
    const view = route.includes("view=calendario") ? "Calendário/Acompanhamento" : "Mapa Estratégico";
    return `\n=== TELA ATUAL ===\nO usuário está olhando: ${view} (rota ${route}). Priorize respostas relacionadas ao planejamento estratégico, ações, responsáveis e prazos.`;
  }
  if (r.startsWith("/dashboards")) {
    return `\n=== TELA ATUAL ===\nO usuário está em Dashboards (${route}). Priorize respostas com gráficos/números recentes — vendas, canais, produtos, horários.`;
  }
  if (r === "/dre" || r.startsWith("/dre/import")) {
    return `\n=== TELA ATUAL ===\nO usuário está na DRE (${route}). Priorize respostas sobre receita, custos, margens, lançamentos do mês.`;
  }
  if (r.startsWith("/dre-v2")) {
    return `\n=== TELA ATUAL ===\nO usuário está na DRE v2 (${route}, espelho do Saipos por XLSX). Priorize comparativo entre DRE calculada e DRE do Saipos.`;
  }
  if (r.startsWith("/configuracoes/saipos")) {
    return `\n=== TELA ATUAL ===\nO usuário está em Configurações Saipos (${route}). Pode estar olhando status de sync, backfill, integração.`;
  }
  return `\n=== TELA ATUAL ===\nRota ${route}.`;
}
