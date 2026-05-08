// Context builder: gathers strategic map + recent KPIs + learned facts
// into a system prompt for the Advisor.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BuiltContext {
  systemPrompt: string;
  hasMapData: boolean;
  hasSalesData: boolean;
  factsCount: number;
  hasDreData?: boolean;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString("pt-BR");

export async function buildAdvisorContext(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<BuiltContext> {
  // -------------------------------------------------
  // 1. Strategic map snapshot
  // -------------------------------------------------
  const mapParts: string[] = [];
  let hasMapData = false;
  try {
    const { data: vision } = await supabase
      .from("vision")
      .select("text, reference_year")
      .limit(1)
      .single();
    if (vision?.text) {
      mapParts.push(`Visão (${vision.reference_year}): ${vision.text}`);
      hasMapData = true;
    }
  } catch { /* table missing or empty */ }

  try {
    const { data: pillars } = await supabase
      .from("pillars")
      .select("id, number, name, obstacles(id, code, description, actions(description, area, responsible, deadline, start_date, status))")
      .order("display_order");
    if (pillars && pillars.length > 0) {
      hasMapData = true;
      mapParts.push("\nPilares estratégicos:");
      for (const p of pillars as any[]) {
        mapParts.push(`  ${p.number}. ${p.name}`);
        const obs = (p.obstacles ?? []) as any[];
        for (const o of obs) {
          mapParts.push(`    ${o.code}${o.description ? `: ${o.description}` : ""}`);
          const acts = (o.actions ?? []) as any[];
          for (const a of acts.slice(0, 5)) {
            const dates = a.status === "agendado" && a.start_date
              ? `início ${a.start_date} → prazo ${a.deadline ?? "?"}`
              : (a.deadline ?? "");
            const meta = [a.area, a.responsible, dates, a.status].filter(Boolean).join(" / ");
            mapParts.push(`      - ${a.description}${meta ? ` (${meta})` : ""}`);
          }
        }
      }
    }
  } catch { /* table missing or empty */ }

  // -------------------------------------------------
  // 1b. Acompanhamento — atrasadas e próximas 7 dias
  // -------------------------------------------------
  try {
    const todayStr = new Date().toISOString().substring(0, 10);
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().substring(0, 10);

    const { data: overdue } = await supabase
      .from("actions")
      .select("description, responsible, deadline, status")
      .lt("deadline", todayStr)
      .neq("status", "concluido")
      .order("deadline", { ascending: true })
      .limit(20);

    const { data: upcoming } = await supabase
      .from("actions")
      .select("description, responsible, deadline, status")
      .gte("deadline", todayStr)
      .lte("deadline", in7Str)
      .neq("status", "concluido")
      .order("deadline", { ascending: true })
      .limit(20);

    if (overdue && overdue.length > 0) {
      mapParts.push("\nAções ATRASADAS:");
      for (const a of overdue as any[]) {
        mapParts.push(`  ⚠ ${a.deadline} — ${a.description}${a.responsible ? ` (${a.responsible})` : ""}`);
      }
    }
    if (upcoming && upcoming.length > 0) {
      mapParts.push("\nAções nos próximos 7 dias:");
      for (const a of upcoming as any[]) {
        mapParts.push(`  · ${a.deadline} — ${a.description}${a.responsible ? ` (${a.responsible})` : ""}`);
      }
    }
  } catch { /* */ }

  // -------------------------------------------------
  // 2. Recent business KPIs (last 30 days vs prior 30)
  // -------------------------------------------------
  const kpiParts: string[] = [];
  let hasSalesData = false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const start30 = new Date(yesterday); start30.setDate(start30.getDate() - 29);
  const startPrev = new Date(start30); startPrev.setDate(startPrev.getDate() - 30);
  const endPrev = new Date(start30); endPrev.setDate(endPrev.getDate() - 1);

  const fmtDate = (d: Date) => d.toISOString().substring(0, 10);

  try {
    const { data: cur } = await supabase.rpc("get_sales_totals", {
      p_start: fmtDate(start30), p_end: fmtDate(yesterday), p_sale_types: null,
    });
    const { data: prev } = await supabase.rpc("get_sales_totals", {
      p_start: fmtDate(startPrev), p_end: fmtDate(endPrev), p_sale_types: null,
    });
    const c = cur?.[0];
    const p = prev?.[0];
    if (c && Number(c.total_orders) > 0) {
      hasSalesData = true;
      const pct = (a: number, b: number) => b > 0 ? `${((a - b) / b * 100).toFixed(1)}%` : "n/a";
      kpiParts.push(
        `KPIs últimos 30 dias (${fmtDate(start30)} → ${fmtDate(yesterday)}):`,
        `  Faturamento: ${fmtBRL(Number(c.total_revenue))} (${p ? pct(Number(c.total_revenue), Number(p.total_revenue)) : "n/a"} vs 30d anteriores)`,
        `  Pedidos: ${fmtInt(Number(c.total_orders))} (${p ? pct(Number(c.total_orders), Number(p.total_orders)) : "n/a"})`,
        `  Ticket médio: ${fmtBRL(Number(c.avg_ticket))} (${p ? pct(Number(c.avg_ticket), Number(p.avg_ticket)) : "n/a"})`,
      );
    }
  } catch { /* RPC missing or empty */ }

  try {
    const { data: byType } = await supabase.rpc("get_sales_by_type", {
      p_start: fmtDate(start30), p_end: fmtDate(yesterday),
    });
    if (byType && byType.length > 0) {
      kpiParts.push("\nVendas por canal (30d):");
      for (const r of byType as any[]) {
        kpiParts.push(`  ${r.type_label}: ${fmtBRL(Number(r.revenue))} (${fmtInt(Number(r.orders))} pedidos)`);
      }
    }
  } catch { /* */ }

  try {
    const { data: top } = await supabase.rpc("get_top_products", {
      p_start: fmtDate(start30), p_end: fmtDate(yesterday), p_sale_types: null, p_limit: 10,
    });
    if (top && top.length > 0) {
      kpiParts.push("\nTop 10 produtos (30d, com dedup entre canais):");
      for (const r of top as any[]) {
        kpiParts.push(`  ${r.display_name}: ${Number(r.quantity).toFixed(0)}x (${fmtBRL(Number(r.revenue))})`);
      }
    }
  } catch { /* */ }

  // -------------------------------------------------
  // 2b. DRE recente (últimos snapshots)
  // -------------------------------------------------
  const dreParts: string[] = [];
  let hasDreData = false;
  try {
    const { data: snapshots } = await supabase
      .from("dre_snapshots")
      .select("period_start, period_end, payload")
      .order("period_end", { ascending: false })
      .limit(2);
    if (snapshots && snapshots.length > 0) {
      hasDreData = true;
      dreParts.push("DRE — snapshots recentes:");
      for (const s of snapshots as any[]) {
        const p = s.payload ?? {};
        const rec = Number(p.receita_total ?? p.total_revenue ?? 0);
        const lucro = Number(p.lucro_liquido ?? p.net_income ?? 0);
        dreParts.push(`  ${s.period_start} → ${s.period_end}: receita ${fmtBRL(rec)}, lucro ${fmtBRL(lucro)}`);
      }
    }
  } catch { /* tabela pode não existir em todas as instâncias */ }

  // -------------------------------------------------
  // 2c. Saipos sync coverage
  // -------------------------------------------------
  const saiposParts: string[] = [];
  try {
    const { data: cov } = await supabase.rpc("get_data_coverage");
    if (cov && (cov as any[]).length > 0) {
      const r = (cov as any[])[0];
      if (r?.first_date && r?.last_date) {
        saiposParts.push(`Saipos: dados de ${r.first_date} até ${r.last_date}.`);
      }
    }
  } catch { /* */ }

  // -------------------------------------------------
  // 2d. Atividade recente do usuário no app
  // -------------------------------------------------
  const activityParts: string[] = [];
  if (userId) {
    try {
      const { data: events } = await supabase
        .from("advisor_app_events")
        .select("occurred_at, route, kind, summary")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(15);
      if (events && events.length > 0) {
        activityParts.push("Últimas atividades do Lucas no app (mais recente primeiro):");
        for (const e of events as any[]) {
          const ts = new Date(e.occurred_at).toLocaleString("pt-BR", {
            dateStyle: "short", timeStyle: "short",
          });
          activityParts.push(`  ${ts} — ${e.summary ?? e.route ?? e.kind}`);
        }
      }
    } catch { /* tabela pode não existir em deploys antigos */ }
  }

  // -------------------------------------------------
  // 3. Learned facts
  // -------------------------------------------------
  const factParts: string[] = [];
  let factsCount = 0;
  if (userId) {
    try {
      const { data: facts } = await supabase
        .from("advisor_facts")
        .select("topic, fact, user_confirmed")
        .eq("user_id", userId)
        .order("topic")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (facts && facts.length > 0) {
        factsCount = facts.length;
        factParts.push("Fatos aprendidos sobre o negócio:");
        let lastTopic = "";
        for (const f of facts as any[]) {
          if (f.topic !== lastTopic) {
            factParts.push(`  [${f.topic}]`);
            lastTopic = f.topic;
          }
          factParts.push(`    - ${f.fact}${f.user_confirmed ? "" : " (a confirmar)"}`);
        }
      }
    } catch { /* */ }
  }

  // -------------------------------------------------
  // Assemble system prompt
  // -------------------------------------------------
  const today_iso = fmtDate(today);

  const sections: string[] = [];

  sections.push(
    `Você é o Advisor da Pizzaria Estrela da Ilha, um conselheiro estratégico para o dono Lucas.

Hoje é ${today_iso}. Você tem acesso a:
- O mapa estratégico atual (visão, pilares, obstáculos, ações)
- Métricas operacionais reais da loja vindas da Saipos (vendas, produtos, status, financeiro)
- Fatos aprendidos sobre o negócio em conversas anteriores
- Ferramentas para consultar números específicos quando precisar

Suas diretrizes:
1. SEMPRE conecte sugestões a um pilar/obstáculo do mapa, ou a um número real, ou a um fato aprendido. Nunca invente.
2. Se não tem certeza ou faltam dados, USE as ferramentas (get_sales_totals, get_top_products, get_sales_by_type, get_status_avg_times, etc.) — não chute.
3. Seja direto e prático. Lucas é dono de restaurante, não acadêmico — mostra ação, não teoria.
4. Quando descobrir algo novo sobre o negócio em uma conversa (preferência, contexto, decisão tomada, restrição), diga "vou registrar isso" e proponha um fato curto pra salvar.
5. Use português do Brasil informal mas profissional. Ticket = R$, formato 1.234,56.
6. Quando citar números, prefira comparativo (vs período anterior, vs ano passado, vs meta).
7. Se for uma pergunta complexa, primeiro entenda o objetivo do Lucas antes de despejar dados.`,
  );

  if (hasMapData) {
    sections.push("\n=== MAPA ESTRATÉGICO ATUAL ===\n" + mapParts.join("\n"));
  } else {
    sections.push("\n=== MAPA ESTRATÉGICO ===\n(Nenhum mapa estratégico cadastrado ainda. Sugira ao Lucas que cadastre visão e pilares.)");
  }

  if (hasSalesData) {
    sections.push("\n=== MÉTRICAS RECENTES (snapshot) ===\n" + kpiParts.join("\n"));
  } else {
    sections.push("\n=== MÉTRICAS RECENTES ===\n(Sem dados de vendas nos últimos 30 dias. O backfill da Saipos pode estar em andamento ou a integração desativada.)");
  }

  if (dreParts.length > 0) {
    sections.push("\n=== DRE ===\n" + dreParts.join("\n"));
  }

  if (saiposParts.length > 0) {
    sections.push("\n=== INTEGRAÇÃO ===\n" + saiposParts.join("\n"));
  }

  if (activityParts.length > 0) {
    sections.push("\n=== ATIVIDADE RECENTE DO USUÁRIO ===\n" + activityParts.join("\n"));
  }

  if (factParts.length > 0) {
    sections.push("\n=== FATOS APRENDIDOS ===\n" + factParts.join("\n"));
  }

  return {
    systemPrompt: sections.join("\n"),
    hasMapData,
    hasSalesData,
    factsCount,
    hasDreData,
  };
}
