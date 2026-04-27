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
