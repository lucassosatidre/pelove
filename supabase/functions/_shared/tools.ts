// Tool definitions exposed to Claude in the Advisor.
// Each tool maps to one of our Postgres RPCs.
// The advisor-chat function executes the tool by calling supabase.rpc(...)
// and returns the result back to Claude.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AnthropicTool } from "./anthropic.ts";

const dateSchema = {
  type: "string",
  description: "Date in ISO format YYYY-MM-DD",
};

const saleTypesSchema = {
  type: ["array", "null"],
  description: "Optional list of sale types to filter (1=Entrega, 2=Balcão, 3=Salão, 4=Ficha). null/omit = all.",
  items: { type: "integer", enum: [1, 2, 3, 4] },
};

export const ADVISOR_TOOLS: AnthropicTool[] = [
  {
    name: "get_sales_totals",
    description: "Total revenue, orders, and average ticket for a date range. Returns a single row.",
    input_schema: {
      type: "object",
      properties: {
        start: dateSchema,
        end: dateSchema,
        sale_types: saleTypesSchema,
      },
      required: ["start", "end"],
    },
  },
  {
    name: "get_sales_series",
    description: "Time series of sales by day/week/month. Use to detect trends.",
    input_schema: {
      type: "object",
      properties: {
        start: dateSchema,
        end: dateSchema,
        granularity: { type: "string", enum: ["day", "week", "month", "year"] },
        sale_types: saleTypesSchema,
      },
      required: ["start", "end", "granularity"],
    },
  },
  {
    name: "get_sales_by_type",
    description: "Sales broken down by channel (Entrega/Balcão/Salão/Ficha).",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema },
      required: ["start", "end"],
    },
  },
  {
    name: "get_sales_by_shift",
    description: "Sales broken down by Saipos shift (Dia/Noite/etc).",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema, sale_types: saleTypesSchema },
      required: ["start", "end"],
    },
  },
  {
    name: "get_top_products",
    description: "Top products by revenue with deduplication across channels (same pizza in Salão+Delivery is one bucket).",
    input_schema: {
      type: "object",
      properties: {
        start: dateSchema,
        end: dateSchema,
        sale_types: saleTypesSchema,
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "get_top_addons",
    description: "Most-used add-ons / complementos with parent products.",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema, limit: { type: "integer", default: 20 } },
      required: ["start", "end"],
    },
  },
  {
    name: "get_status_avg_times",
    description: "Average / median / P90 time spent in each order status (Cozinha, Pronto, Cancelado, etc).",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema, sale_types: saleTypesSchema },
      required: ["start", "end"],
    },
  },
  {
    name: "get_cancellations",
    description: "Cancellation totals, value lost, rate, breakdown by reason and by day.",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema, sale_types: saleTypesSchema },
      required: ["start", "end"],
    },
  },
  {
    name: "get_top_customers",
    description: "Top customers by revenue with last/first order, ticket, count.",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema, limit: { type: "integer", default: 20 } },
      required: ["start", "end"],
    },
  },
  {
    name: "get_table_metrics",
    description: "Table service metrics: avg table size, avg revenue, avg minutes open.",
    input_schema: {
      type: "object",
      properties: { start: dateSchema, end: dateSchema },
      required: ["start", "end"],
    },
  },
  {
    name: "get_data_coverage",
    description: "Earliest and latest date with sales data in the local mirror. Useful to know what range is queryable.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "save_fact",
    description: "Save a long-term fact about the business (a preference, decision, context, restriction). Use when you learn something the user told you that should persist across conversations.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Category like 'operacao', 'preferencia', 'financeiro', 'cardapio', 'time', 'concorrencia', 'cliente'",
        },
        fact: { type: "string", description: "The fact in 1-2 short sentences in pt-BR." },
      },
      required: ["topic", "fact"],
    },
  },
  {
    name: "list_strategic_actions",
    description: "List actions from the strategic map filtered by status, responsible person, pillar, or date range. Use when the user asks about who is doing what, what is overdue, or upcoming deliveries.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["agendado", "nao_iniciado", "em_andamento", "concluido", "atrasado", null],
          description: "Filter by status. 'atrasado' means deadline < today AND status != concluido.",
        },
        responsible_contains: {
          type: ["string", "null"],
          description: "Substring match (case-insensitive) on responsible field. Ex: 'Lucas' matches 'Lucas Tidre, Ana'.",
        },
        deadline_from: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
        deadline_to: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
        pillar_number: { type: ["integer", "null"], description: "Filter to a specific pillar number." },
        limit: { type: "integer", default: 30, minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "get_dre_snapshot",
    description: "Latest DRE snapshots (calculated income statement) ordered by period_end desc.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 3, minimum: 1, maximum: 12 },
      },
    },
  },
];

// Execute a tool call by name. Returns a string the model can read.
export async function executeTool(
  supabase: SupabaseClient,
  userId: string | null,
  name: string,
  input: any,
): Promise<{ result: string; isError: boolean }> {
  try {
    if (name === "save_fact") {
      if (!userId) return { result: "Could not save fact: no authenticated user.", isError: true };
      const { data, error } = await supabase.from("advisor_facts").insert({
        user_id: userId,
        topic: String(input.topic ?? "geral").toLowerCase().substring(0, 50),
        fact: String(input.fact ?? "").substring(0, 1000),
        user_confirmed: false,
      }).select("id, topic, fact").single();
      if (error) throw error;
      return { result: `Fato salvo (id=${data.id}, topic=${data.topic}). Será carregado em conversas futuras.`, isError: false };
    }

    if (name === "list_strategic_actions") {
      const today = new Date().toISOString().substring(0, 10);
      const limit = Math.min(Math.max(Number(input?.limit ?? 30), 1), 100);
      let q = supabase
        .from("actions")
        .select("description, area, responsible, deadline, start_date, status, obstacle_id, obstacles(code, pillar_id, pillars(number, name))")
        .limit(limit);

      if (input?.status === "atrasado") {
        q = q.lt("deadline", today).neq("status", "concluido");
      } else if (typeof input?.status === "string") {
        q = q.eq("status", input.status);
      }
      if (typeof input?.responsible_contains === "string" && input.responsible_contains.trim()) {
        q = q.ilike("responsible", `%${input.responsible_contains.trim()}%`);
      }
      if (typeof input?.deadline_from === "string") q = q.gte("deadline", input.deadline_from);
      if (typeof input?.deadline_to === "string") q = q.lte("deadline", input.deadline_to);
      if (typeof input?.pillar_number === "number") {
        // Filter by joining pillar number — Supabase doesn't allow direct joined-column filtering on
        // nested syntax, so we resolve the pillar id first.
        const { data: pillarRow } = await supabase
          .from("pillars").select("id").eq("number", input.pillar_number).maybeSingle();
        if (pillarRow?.id) {
          const { data: obs } = await supabase
            .from("obstacles").select("id").eq("pillar_id", pillarRow.id);
          const ids = (obs ?? []).map((o: any) => o.id);
          if (ids.length === 0) return { result: JSON.stringify([]), isError: false };
          q = q.in("obstacle_id", ids);
        }
      }

      q = q.order("deadline", { ascending: true, nullsFirst: false });
      const { data, error } = await q;
      if (error) throw error;
      const flat = (data ?? []).map((row: any) => ({
        description: row.description,
        area: row.area,
        responsible: row.responsible,
        start_date: row.start_date,
        deadline: row.deadline,
        status: row.status,
        is_overdue: row.deadline && row.deadline < today && row.status !== "concluido",
        obstacle: row.obstacles?.code,
        pillar: row.obstacles?.pillars
          ? `${row.obstacles.pillars.number}. ${row.obstacles.pillars.name}`
          : null,
      }));
      return { result: JSON.stringify(flat), isError: false };
    }

    if (name === "get_dre_snapshot") {
      const limit = Math.min(Math.max(Number(input?.limit ?? 3), 1), 12);
      const { data, error } = await supabase
        .from("dre_snapshots")
        .select("period_start, period_end, payload, created_at")
        .order("period_end", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return { result: JSON.stringify(data ?? []), isError: false };
    }

    // RPC tools — map input to RPC params
    const args: Record<string, any> = {};
    if (input.start) args.p_start = input.start;
    if (input.end) args.p_end = input.end;
    if (input.granularity) args.p_granularity = input.granularity;
    if (input.sale_types !== undefined) args.p_sale_types = input.sale_types ?? null;
    if (input.limit !== undefined) args.p_limit = input.limit;
    if (input.top_products !== undefined) args.p_top_products = input.top_products;

    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;

    // Return as JSON string. Truncate hard if very large to avoid blowing tokens.
    let json = JSON.stringify(data ?? null);
    if (json.length > 25_000) {
      json = json.substring(0, 25_000) + "\n...[truncated]";
    }
    return { result: json, isError: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: `Tool error: ${msg}`, isError: true };
  }
}
