// Generates 1-3 insights about yesterday's data and saves them
// to advisor_insights. Designed to be called by a daily cron at ~05h.
//
// Strategy:
//   1. Pull yesterday's metrics + comparison vs prior day-of-week
//   2. Pull last-7-days vs prior 7
//   3. Send a concise prompt to Claude asking for 1-3 insights
//      in a strict JSON format
//   4. Insert each insight as a row
//
// POST {} (no body required)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic, extractText, DEFAULT_MODEL } from "../_shared/anthropic.ts";
import { buildAdvisorContext } from "../_shared/context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fmtDate = (d: Date) => d.toISOString().substring(0, 10);
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface GeneratedInsight {
  severity: "info" | "success" | "warning" | "critical";
  domain: "vendas" | "produtos" | "operacao" | "pessoas" | "estrategia";
  title: string;
  body: string;
  metadata?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(yesterday); weekAgo.setDate(weekAgo.getDate() - 6);
    const twoWeeksAgo = new Date(yesterday); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
    const oneWeekBefore = new Date(weekAgo); oneWeekBefore.setDate(oneWeekBefore.getDate() - 1);

    // -----------------------------------------------------
    // Skip if we already generated insights for yesterday
    // -----------------------------------------------------
    const { data: existing } = await supabase
      .from("advisor_insights")
      .select("id", { count: "exact", head: true })
      .eq("for_date", fmtDate(yesterday))
      .eq("generated_by", "cron");

    if ((existing as any)?.count && (existing as any).count > 0) {
      return jsonResponse({ skipped: true, reason: "Insights already generated for yesterday" });
    }

    // -----------------------------------------------------
    // Pull data points
    // -----------------------------------------------------
    const dataSnapshot: any = {
      yesterday: fmtDate(yesterday),
      last_7_days: { start: fmtDate(weekAgo), end: fmtDate(yesterday) },
      prior_7_days: { start: fmtDate(twoWeeksAgo), end: fmtDate(oneWeekBefore) },
    };

    const safeRpc = async (name: string, args: any) => {
      try {
        const { data } = await supabase.rpc(name, args);
        return data;
      } catch { return null; }
    };

    const [
      ytotals, prevDayTotals,
      week7Totals, prevWeek7Totals,
      byType7, byShift7, top10, statusTimes, cancellations,
    ] = await Promise.all([
      safeRpc("get_sales_totals", { p_start: fmtDate(yesterday), p_end: fmtDate(yesterday), p_sale_types: null }),
      safeRpc("get_sales_totals", {
        p_start: fmtDate(new Date(yesterday.getTime() - 7 * 86400000)),
        p_end: fmtDate(new Date(yesterday.getTime() - 7 * 86400000)),
        p_sale_types: null,
      }),
      safeRpc("get_sales_totals", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday), p_sale_types: null }),
      safeRpc("get_sales_totals", { p_start: fmtDate(twoWeeksAgo), p_end: fmtDate(oneWeekBefore), p_sale_types: null }),
      safeRpc("get_sales_by_type", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday) }),
      safeRpc("get_sales_by_shift", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday), p_sale_types: null }),
      safeRpc("get_top_products", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday), p_sale_types: null, p_limit: 10 }),
      safeRpc("get_status_avg_times", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday), p_sale_types: null }),
      safeRpc("get_cancellations", { p_start: fmtDate(weekAgo), p_end: fmtDate(yesterday), p_sale_types: null }),
    ]);

    dataSnapshot.yesterday_totals = ytotals?.[0] ?? null;
    dataSnapshot.same_dow_last_week = prevDayTotals?.[0] ?? null;
    dataSnapshot.last_7d = week7Totals?.[0] ?? null;
    dataSnapshot.prior_7d = prevWeek7Totals?.[0] ?? null;
    dataSnapshot.by_type_7d = byType7 ?? [];
    dataSnapshot.by_shift_7d = byShift7 ?? [];
    dataSnapshot.top_products_7d = top10 ?? [];
    dataSnapshot.status_times_7d = statusTimes ?? [];
    dataSnapshot.cancellations_7d = cancellations?.[0] ?? null;

    // If no data at all, abort gracefully
    if (!dataSnapshot.yesterday_totals && !dataSnapshot.last_7d) {
      return jsonResponse({ skipped: true, reason: "No sales data available yet" });
    }

    // Pull strategic context too — without binding to a specific user
    const ctx = await buildAdvisorContext(supabase, null);

    // -----------------------------------------------------
    // Ask Claude for insights
    // -----------------------------------------------------
    const userPrompt = `Você vai gerar entre 1 e 3 INSIGHTS curtos sobre o desempenho da pizzaria, a partir dos dados abaixo.

REGRAS:
- Cada insight: 1 título curto (até 60 chars) + 1 corpo de 1-3 frases (até 280 chars).
- Use SOMENTE dados que aparecem no JSON. Não invente.
- Conecte a algum pilar/obstáculo do mapa estratégico se fizer sentido.
- Severidade: 'success' (vitória), 'info' (observação útil), 'warning' (sinal de atenção), 'critical' (problema sério).
- Domínio: 'vendas', 'produtos', 'operacao', 'pessoas' ou 'estrategia'.
- Foque em mudanças significativas (>10% pra cima ou pra baixo), padrões inesperados, ou alertas.
- NÃO faça insight só por fazer. Se o dia foi normal, retorne apenas 1 insight de 'info'.

RESPOSTA: SOMENTE um JSON válido neste formato (nada antes ou depois):
{
  "insights": [
    { "severity": "warning", "domain": "vendas", "title": "...", "body": "...", "metadata": {} }
  ]
}

DADOS:
${JSON.stringify(dataSnapshot, null, 2)}`;

    const resp = await callAnthropic({
      model: DEFAULT_MODEL,
      system: ctx.systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 2048,
      temperature: 0.4,
    });

    const text = extractText(resp.content).trim();
    let parsed: { insights: GeneratedInsight[] } | null = null;

    // Try to recover JSON even if the model wraps it in markdown fences
    let toParse = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) toParse = fenceMatch[1];
    try {
      parsed = JSON.parse(toParse);
    } catch (e) {
      console.error("[insights] JSON parse error:", e, "text:", text.substring(0, 500));
    }

    if (!parsed || !Array.isArray(parsed.insights) || parsed.insights.length === 0) {
      return jsonResponse({
        success: false,
        error: "Could not parse insights from Claude response",
        raw: text.substring(0, 500),
      });
    }

    // -----------------------------------------------------
    // Save insights
    // -----------------------------------------------------
    const rows = parsed.insights.slice(0, 3).map((i) => ({
      for_date: fmtDate(yesterday),
      severity: i.severity ?? "info",
      domain: i.domain ?? "vendas",
      title: String(i.title ?? "").substring(0, 200),
      body: String(i.body ?? "").substring(0, 800),
      metadata: i.metadata ?? null,
      generated_by: "cron",
      generation_model: resp.model,
    }));

    const { data: inserted, error } = await supabase
      .from("advisor_insights")
      .insert(rows)
      .select("id, severity, domain, title");
    if (error) throw error;

    return jsonResponse({
      success: true,
      generated_count: inserted?.length ?? 0,
      insights: inserted,
      usage: resp.usage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[advisor-generate-insights] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(payload: any) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
