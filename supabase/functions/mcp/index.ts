// MCP server (JSON-RPC 2.0) — Bearer auth via OPENCLAW_MCP_TOKEN.
// Implements: initialize, tools/list, tools/call.
// Logs every tool call into public.clau_tool_logs (caller='openclaw').

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_TOKEN = Deno.env.get("OPENCLAW_MCP_TOKEN") ?? "";
const CALLER = "openclaw";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----------------------------- Tool catalog -----------------------------

type ToolHandler = (args: any) => Promise<unknown>;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

const dateProp = { type: "string", description: "ISO date YYYY-MM-DD" };
const saleTypesProp = {
  type: ["array", "null"],
  description: "1=Entrega, 2=Balcão, 3=Salão, 4=Ficha. null/omit = todos.",
  items: { type: "integer", enum: [1, 2, 3, 4] },
};

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function rpcTool(
  name: string,
  description: string,
  required: string[],
  properties: Record<string, unknown>,
  mapArgs: (input: any) => Record<string, unknown>,
): ToolDef {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required },
    handler: (input) => rpc(name, mapArgs(input ?? {})),
  };
}

const TOOLS: ToolDef[] = [
  rpcTool(
    "get_sales_totals",
    "Receita, pedidos e ticket médio para um intervalo de datas.",
    ["start", "end"],
    { start: dateProp, end: dateProp, sale_types: saleTypesProp },
    (i) => ({ p_start: i.start, p_end: i.end, p_sale_types: i.sale_types ?? null }),
  ),
  rpcTool(
    "get_sales_series",
    "Série temporal de vendas (day/week/month/year).",
    ["start", "end", "granularity"],
    {
      start: dateProp, end: dateProp,
      granularity: { type: "string", enum: ["day", "week", "month", "year"] },
      sale_types: saleTypesProp,
    },
    (i) => ({ p_start: i.start, p_end: i.end, p_granularity: i.granularity, p_sale_types: i.sale_types ?? null }),
  ),
  rpcTool(
    "get_sales_by_type",
    "Vendas por canal (Entrega/Balcão/Salão/Ficha).",
    ["start", "end"],
    { start: dateProp, end: dateProp },
    (i) => ({ p_start: i.start, p_end: i.end }),
  ),
  rpcTool(
    "get_sales_by_shift",
    "Vendas por turno Saipos.",
    ["start", "end"],
    { start: dateProp, end: dateProp, sale_types: saleTypesProp },
    (i) => ({ p_start: i.start, p_end: i.end, p_sale_types: i.sale_types ?? null }),
  ),
  rpcTool(
    "get_top_products",
    "Produtos mais vendidos por receita (deduplicado por canal).",
    ["start", "end"],
    {
      start: dateProp, end: dateProp, sale_types: saleTypesProp,
      limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
    },
    (i) => ({ p_start: i.start, p_end: i.end, p_sale_types: i.sale_types ?? null, p_limit: i.limit ?? 30 }),
  ),
  rpcTool(
    "get_top_addons",
    "Complementos mais usados com produtos pais.",
    ["start", "end"],
    { start: dateProp, end: dateProp, limit: { type: "integer", default: 30 } },
    (i) => ({ p_start: i.start, p_end: i.end, p_limit: i.limit ?? 30 }),
  ),
  rpcTool(
    "get_status_avg_times",
    "Tempo médio/mediano/P90 em cada status de pedido.",
    ["start", "end"],
    { start: dateProp, end: dateProp, sale_types: saleTypesProp },
    (i) => ({ p_start: i.start, p_end: i.end, p_sale_types: i.sale_types ?? null }),
  ),
  rpcTool(
    "get_cancellations",
    "Totais e quebras de cancelamentos (motivo, dia).",
    ["start", "end"],
    { start: dateProp, end: dateProp, sale_types: saleTypesProp },
    (i) => ({ p_start: i.start, p_end: i.end, p_sale_types: i.sale_types ?? null }),
  ),
  rpcTool(
    "get_top_customers",
    "Top clientes por receita.",
    ["start", "end"],
    { start: dateProp, end: dateProp, limit: { type: "integer", default: 30 } },
    (i) => ({ p_start: i.start, p_end: i.end, p_limit: i.limit ?? 30 }),
  ),
  rpcTool(
    "get_table_metrics",
    "Métricas de mesa: tamanho médio, receita média, minutos abertos.",
    ["start", "end"],
    { start: dateProp, end: dateProp },
    (i) => ({ p_start: i.start, p_end: i.end }),
  ),
  rpcTool(
    "get_data_coverage",
    "Datas mín/máx de vendas no espelho local.",
    [],
    {},
    () => ({}),
  ),
  rpcTool(
    "get_dre_summary",
    "Resumo do DRE (receita bruta/líquida, CMV, custo vendas, lucro etc).",
    ["start", "end"],
    { start: dateProp, end: dateProp },
    (i) => ({ p_start: i.start, p_end: i.end }),
  ),
  rpcTool(
    "get_dre_monthly_evolution",
    "Evolução mensal do DRE no período.",
    ["start", "end"],
    { start: dateProp, end: dateProp },
    (i) => ({ p_start: i.start, p_end: i.end }),
  ),
  rpcTool(
    "get_dre_expenses_by_group",
    "Despesas agrupadas por classificação DRE.",
    ["start", "end"],
    { start: dateProp, end: dateProp },
    (i) => ({ p_start: i.start, p_end: i.end }),
  ),

  // Strategic map (planejamento)
  {
    name: "list_strategic_actions",
    description: "Lista ações do mapa estratégico filtradas por status, responsável, pilar ou prazo.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: ["string", "null"], enum: ["agendado", "nao_iniciado", "em_andamento", "concluido", "atrasado", null] },
        responsible_contains: { type: ["string", "null"] },
        deadline_from: { type: ["string", "null"] },
        deadline_to: { type: ["string", "null"] },
        pillar_number: { type: ["integer", "null"] },
        limit: { type: "integer", default: 30, minimum: 1, maximum: 100 },
      },
    },
    handler: async (input) => {
      const today = new Date().toISOString().substring(0, 10);
      const limit = Math.min(Math.max(Number(input?.limit ?? 30), 1), 100);
      let q = supabase
        .from("actions")
        .select("description, area, responsible, deadline, start_date, status, obstacle_id, obstacles(code, pillar_id, pillars(number, name))")
        .limit(limit);

      if (input?.status === "atrasado") q = q.lt("deadline", today).neq("status", "concluido");
      else if (typeof input?.status === "string") q = q.eq("status", input.status);
      if (typeof input?.responsible_contains === "string" && input.responsible_contains.trim())
        q = q.ilike("responsible", `%${input.responsible_contains.trim()}%`);
      if (typeof input?.deadline_from === "string") q = q.gte("deadline", input.deadline_from);
      if (typeof input?.deadline_to === "string") q = q.lte("deadline", input.deadline_to);
      if (typeof input?.pillar_number === "number") {
        const { data: p } = await supabase.from("pillars").select("id").eq("number", input.pillar_number).maybeSingle();
        if (p?.id) {
          const { data: obs } = await supabase.from("obstacles").select("id").eq("pillar_id", p.id);
          const ids = (obs ?? []).map((o: any) => o.id);
          if (!ids.length) return [];
          q = q.in("obstacle_id", ids);
        } else {
          return [];
        }
      }

      q = q.order("deadline", { ascending: true, nullsFirst: false });
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: any) => ({
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
    },
  },

  // Generic SELECT escape hatch — uses run_sql_select (SECURITY INVOKER, service_role only)
  {
    name: "run_sql_select",
    description: "Executa uma consulta SELECT/WITH read-only no banco. Bloqueia escrita e DDL. Limite 1000 linhas.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT ou WITH ... SELECT. Sem ;, sem múltiplos statements." },
      },
      required: ["sql"],
    },
    handler: async (input) => {
      const sql = String(input?.sql ?? "");
      const { data, error } = await supabase.rpc("run_sql_select", { p_sql: sql });
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

const TOOL_INDEX = new Map(TOOLS.map((t) => [t.name, t]));

// ----------------------------- Logging -----------------------------

async function logCall(opts: {
  tool_name: string;
  args: unknown;
  status: "ok" | "error";
  error_message?: string;
  duration_ms: number;
  result_size?: number;
}) {
  try {
    await supabase.from("clau_tool_logs").insert({
      caller: CALLER,
      tool_name: opts.tool_name,
      args: opts.args ?? null,
      status: opts.status,
      error_message: opts.error_message ?? null,
      duration_ms: opts.duration_ms,
      result_size: opts.result_size ?? null,
    });
  } catch { /* silent */ }
}

// ----------------------------- JSON-RPC -----------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcResult(id: any, result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id, result });
}

function rpcError(id: any, code: number, message: string, status = 200) {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status);
}

async function handleRpc(req: any) {
  const id = req?.id ?? null;
  const method = req?.method;
  const params = req?.params ?? {};

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "pelove-mcp", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized" || method?.startsWith?.("notifications/")) {
    // No response for notifications
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method === "ping") return rpcResult(id, {});

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    const tool = TOOL_INDEX.get(name);
    if (!tool) {
      return rpcError(id, -32602, `Unknown tool: ${name}`);
    }
    const t0 = Date.now();
    try {
      const data = await tool.handler(args);
      const text = typeof data === "string" ? data : JSON.stringify(data);
      const truncated = text.length > 50_000 ? text.substring(0, 50_000) + "\n...[truncated]" : text;
      void logCall({
        tool_name: name, args, status: "ok",
        duration_ms: Date.now() - t0, result_size: text.length,
      });
      return rpcResult(id, {
        content: [{ type: "text", text: truncated }],
        isError: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void logCall({
        tool_name: name, args, status: "error",
        error_message: msg, duration_ms: Date.now() - t0,
      });
      return rpcResult(id, {
        content: [{ type: "text", text: `Tool error: ${msg}` }],
        isError: true,
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

// ----------------------------- HTTP entrypoint -----------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Bearer auth
  if (!MCP_TOKEN) {
    return jsonResponse({ error: "OPENCLAW_MCP_TOKEN não configurado no servidor" }, 500);
  }
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!provided || provided !== MCP_TOKEN) {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, 401);
  }

  if (req.method === "GET") {
    return jsonResponse({
      name: "pelove-mcp",
      version: "1.0.0",
      transport: "http-jsonrpc",
      tools: TOOLS.map((t) => t.name),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  // Batch
  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map(handleRpc));
    const parsed = await Promise.all(
      responses.map(async (r) => {
        if (r.status === 204) return null;
        try { return JSON.parse(await r.text()); } catch { return null; }
      }),
    );
    return jsonResponse(parsed.filter((x) => x !== null));
  }

  return await handleRpc(body);
});
