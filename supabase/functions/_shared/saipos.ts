// Shared helpers for Saipos sync edge functions.
// All sync functions use these to keep behavior consistent.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const SAIPOS_BASE = "https://data.saipos.io/v1";

export type Endpoint = "sales" | "sales_items" | "sales_status_histories" | "financial";

export interface EndpointConfig {
  path: string;
  defaultDateColumn: string;
  table: string;
  pkColumn: string;
}

export const ENDPOINTS: Record<Endpoint, EndpointConfig> = {
  sales: {
    path: "/search_sales",
    defaultDateColumn: "updated_at",
    table: "saipos_sales",
    pkColumn: "id_sale",
  },
  sales_items: {
    path: "/sales_items",
    defaultDateColumn: "updated_at",
    table: "saipos_sales_items",
    pkColumn: "id_sale_item",
  },
  sales_status_histories: {
    path: "/sales_status_histories",
    defaultDateColumn: "updated_at",
    table: "saipos_status_history",
    pkColumn: "id_sale_status_history",
  },
  financial: {
    path: "/search_financial_transactions",
    defaultDateColumn: "updated_at",
    table: "saipos_financial",
    pkColumn: "id_store_fin_transaction",
  },
};

export function fmtDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function getToken(): string {
  // Accept either name — Lovable sometimes provisions secrets as *_API_KEY
  const t = Deno.env.get("SAIPOS_API_TOKEN") ?? Deno.env.get("SAIPOS_API_KEY");
  if (!t) {
    throw new Error("Saipos token not set: define SAIPOS_API_TOKEN or SAIPOS_API_KEY as edge function secret");
  }
  return t.trim();
}

// ----------------------------------------------------
// API call: fetch one page from Saipos
// ----------------------------------------------------
export interface FetchPageResult {
  status: number;
  ok: boolean;
  records: any[];
  rawBodyPreview: string;
}

export async function fetchSaiposPage(
  endpoint: Endpoint,
  dateColumn: string,
  start: Date,
  end: Date,
  limit: number,
  offset: number,
): Promise<FetchPageResult> {
  const cfg = ENDPOINTS[endpoint];
  const url = new URL(`${SAIPOS_BASE}${cfg.path}`);
  url.searchParams.set("p_date_column_filter", dateColumn);
  url.searchParams.set("p_filter_date_start", fmtDateTime(start));
  url.searchParams.set("p_filter_date_end", fmtDateTime(end));
  url.searchParams.set("p_limit", String(limit));
  url.searchParams.set("p_offset", String(offset));

  // Network/connect errors throw before any response is received.
  // Convert to a non-ok FetchPageResult with status 0 so the retry loop
  // treats them as transient and retries (vs throwing and aborting).
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 0,
      ok: false,
      records: [],
      rawBodyPreview: `network error: ${msg}`,
    };
  }

  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: res.status,
      ok: false,
      records: [],
      rawBodyPreview: `body read error: ${msg}`,
    };
  }

  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }

  let records: any[] = [];
  if (Array.isArray(parsed)) records = parsed;
  else if (parsed && typeof parsed === "object") {
    const arr = Object.values(parsed).find((v) => Array.isArray(v));
    if (arr) records = arr as any[];
  }

  return {
    status: res.status,
    ok: res.ok,
    records,
    rawBodyPreview: text.substring(0, 200),
  };
}

// Retry one page on transient errors with exponential backoff.
// Transient = network error (status 0) or 5xx server error.
// 4xx is treated as terminal — retrying won't help.
async function fetchPageWithRetry(
  endpoint: Endpoint,
  dateColumn: string,
  start: Date,
  end: Date,
  limit: number,
  offset: number,
  maxAttempts = 4,
): Promise<FetchPageResult> {
  let lastErr: FetchPageResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetchSaiposPage(endpoint, dateColumn, start, end, limit, offset);
    if (r.ok) return r;
    // 4xx is terminal — but only if it's a real HTTP 4xx, not our synthetic 0
    if (r.status >= 400 && r.status < 500) return r;
    lastErr = r;
    if (attempt < maxAttempts) {
      const waitMs = [2000, 5000, 12000, 25000][attempt - 1] ?? 25000;
      console.log(
        `Saipos ${endpoint} transient error (status=${r.status}, body=${r.rawBodyPreview.substring(0, 100)}), retry ${attempt}/${maxAttempts} in ${waitMs}ms`,
      );
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }
  return lastErr!;
}

// Pagination loop. Returns all records of the window.
// Hard cap: maxPages to avoid runaway cost in dev.
export async function fetchAllPages(
  endpoint: Endpoint,
  dateColumn: string,
  start: Date,
  end: Date,
  pageSize = 1000,
  maxPages = 50,
): Promise<{ records: any[]; status: number; pages: number }> {
  const all: any[] = [];
  let offset = 0;
  let pages = 0;
  let lastStatus = 200;
  while (pages < maxPages) {
    const r = await fetchPageWithRetry(endpoint, dateColumn, start, end, pageSize, offset);
    lastStatus = r.status;
    if (!r.ok) {
      throw new Error(`Saipos API ${endpoint} returned ${r.status}: ${r.rawBodyPreview}`);
    }
    all.push(...r.records);
    pages++;
    if (r.records.length < pageSize) break;
    offset += pageSize;
  }
  return { records: all, status: lastStatus, pages };
}

// ----------------------------------------------------
// Sync run logging
// ----------------------------------------------------
export interface SyncRunInput {
  runType: string;
  endpoint: string;
  dateColumn?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

export async function startSyncRun(
  supabase: SupabaseClient,
  input: SyncRunInput,
): Promise<number> {
  const { data, error } = await supabase
    .from("saipos_sync_runs")
    .insert({
      run_type: input.runType,
      endpoint: input.endpoint,
      date_column: input.dateColumn ?? null,
      period_start: input.periodStart?.toISOString() ?? null,
      period_end: input.periodEnd?.toISOString() ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as number;
}

export async function finishSyncRun(
  supabase: SupabaseClient,
  runId: number,
  result: {
    httpStatus?: number;
    received: number;
    upserted: number;
    status: "success" | "error";
    errorMessage?: string;
    startedAt: number;
  },
) {
  const finishedAt = Date.now();
  await supabase
    .from("saipos_sync_runs")
    .update({
      http_status: result.httpStatus ?? null,
      records_received: result.received,
      records_upserted: result.upserted,
      status: result.status,
      error_message: result.errorMessage ?? null,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - result.startedAt,
    })
    .eq("id", runId);
}

// ----------------------------------------------------
// Mappers — Saipos record → row in mirror table
// ----------------------------------------------------

function asTimestamptz(v: any): string | null {
  if (!v) return null;
  if (typeof v !== "string") return null;
  return v;
}

function asNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function asInt(v: any): number | null {
  const n = asNumber(v);
  return n === null ? null : Math.trunc(n);
}

function asYN(v: any): boolean | null {
  if (v === "Y") return true;
  if (v === "N") return false;
  return null;
}

export function normalizeProductName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(p|m|g|gg|pequena|media|grande|gigante|brotinho|broto)\b/g, "")
    .replace(/\b(salao|delivery|balcao|ifood|rappi)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapSale(r: any): Record<string, any> {
  return {
    id_sale: r.id_sale,
    id_store: r.id_store ?? null,
    id_sale_type: r.id_sale_type ?? null,
    sale_number: r.sale_number ?? null,
    desc_sale: r.desc_sale ?? null,
    created_at: asTimestamptz(r.created_at),
    updated_at: asTimestamptz(r.updated_at),
    shift_date: r.shift_date ?? null,
    total_amount: asNumber(r.total_amount ?? r.totals?.total_amount),
    total_amount_items: asNumber(r.total_amount_items ?? r.totals?.total_amount_items),
    total_discount: asNumber(r.total_discount ?? r.totals?.total_discount),
    total_increase: asNumber(r.total_increase ?? r.totals?.total_increase),
    canceled: asYN(r.canceled) ?? false,
    count_canceled_items: asInt(r.count_canceled_items) ?? 0,
    customer_id_customer: r.customer?.id_customer ?? null,
    customer_name: r.customer?.name ?? null,
    customer_phone: Array.isArray(r.customer?.phone) ? r.customer.phone[0] ?? null : r.customer?.phone ?? null,
    customer_document: r.customer?.cpf_cnpj ?? r.customer?.document ?? null,
    store_shift_desc: r.store_shift?.desc_store_shift ?? null,
    store_shift_starting_time: r.store_shift?.starting_time ?? null,
    delivery_fee: asNumber(r.delivery?.delivery_fee),
    delivery_neighborhood: r.delivery?.district ?? null,
    delivery_city: r.delivery?.city ?? null,
    delivery_man_name: r.delivery_man?.delivery_man_name ?? null,
    partner_desc: r.partner_sale?.desc_store_partner || null,
    partner_cod_sale1: r.partner_sale?.cod_sale1 || null,
    partner_status: r.partner_sale?.partner_status || null,
    table_id_table: r.table_order?.id_store_table || null,
    table_total_service_charge: asNumber(r.table_order?.total_service_charge_amount),
    table_service_charge_percent: asNumber(r.table_order?.service_charge),
    table_customers_count: asInt(r.table_order?.customers_on_table),
    ticket_number: asInt(r.ticket?.number),
    schedule_datetime: asTimestamptz(r.schedule?.schedule_datetime),
    nfce_serie: r.nfce?.serie ?? null,
    nfce_numero: asInt(r.nfce?.numero),
    nfce_data_emissao: asTimestamptz(r.nfce?.data_emissao),
    raw_payload: r,
    saipos_synced_at: new Date().toISOString(),
  };
}

// /sales_items returns one row per sale containing an `items` array.
// We expand to one row per item.
export function mapSaleItems(r: any): Record<string, any>[] {
  const items = Array.isArray(r.items) ? r.items : [];
  return items
    .filter((it: any) => it?.id_sale_item != null)
    .map((it: any) => ({
      id_sale_item: it.id_sale_item,
      id_sale: r.id_sale,
      id_store: r.id_store ?? null,
      id_sale_type: r.id_sale_type ?? null,
      shift_date: r.shift_date ? String(r.shift_date).substring(0, 10) : null,
      item_created_at: asTimestamptz(it.created_at),
      item_updated_at: asTimestamptz(it.updated_at),
      done_at: asTimestamptz(it.done_at),
      id_store_item: it.id_store_item ?? null,
      desc_sale_item: it.desc_sale_item ?? null,
      integration_code: it.integration_code ?? null,
      id_store_variation: it.id_store_variation ?? null,
      quantity: asNumber(it.quantity),
      unit_price: asNumber(it.unit_price),
      status: asInt(it.status),
      deleted: asYN(it.deleted) ?? false,
      deleted_at: asTimestamptz(it.deleted_at),
      deleted_by: it.deleted_by ?? null,
      created_by: it.created_by ?? null,
      id_store_waiter: it.id_store_waiter ?? null,
      group_sequence: it.group_sequence ?? null,
      id_sale_to: it.id_sale_to ?? null,
      id_sale_from: it.id_sale_from ?? null,
      id_store_cancellation_reason: it.id_store_cancellation_reason ?? null,
      normalized_name: normalizeProductName(it.desc_sale_item),
      raw_payload: it,
      saipos_synced_at: new Date().toISOString(),
    }));
}

// /sales_status_histories returns one row per sale containing a `histories` array.
export function mapStatusHistories(r: any): Record<string, any>[] {
  const histories = Array.isArray(r.histories) ? r.histories : [];
  return histories
    .filter((h: any) => h?.id_sale_status_history != null)
    .map((h: any) => ({
      id_sale_status_history: h.id_sale_status_history,
      id_sale: r.id_sale,
      id_store: r.id_store ?? null,
      shift_date: r.shift_date ? String(r.shift_date).substring(0, 10) : null,
      history_created_at: asTimestamptz(h.created_at),
      display_order: asInt(h.order),
      duration_time_seconds: asInt(h.duration_time_seconds),
      desc_store_sale_status: h.desc_store_sale_status ?? null,
      desc_cancellation_reason: h.desc_cancellation_reason ?? null,
      user_id_user: h.user?.id_user ?? null,
      user_full_name: h.user?.full_name ?? null,
      user_email: h.user?.email ?? null,
      user_type: asInt(h.user?.user_type),
      authorized_by_id_user: h.authorized_by?.id_user ?? null,
      authorized_by_full_name: h.authorized_by?.full_name ?? null,
      raw_payload: h,
      saipos_synced_at: new Date().toISOString(),
    }));
}

export function mapFinancial(r: any): Record<string, any> {
  return {
    id_store_fin_transaction: r.id_store_fin_transaction,
    id_store: r.id_store ?? null,
    date: asTimestamptz(r.date),
    payment_date: asTimestamptz(r.payment_date),
    issuance_date: asTimestamptz(r.issuance_date),
    created_at: asTimestamptz(r.created_at),
    updated_at: asTimestamptz(r.updated_at),
    amount: asNumber(r.amount),
    paid: asYN(r.paid),
    conciliated: asYN(r.conciliated),
    recurring: asYN(r.recurring),
    installment: asInt(r.installment),
    total_installments: asInt(r.total_installments),
    desc_store_fin_transaction: r.desc_store_fin_transaction ?? null,
    desc_store_category_financial: r.desc_store_category_financial ?? null,
    desc_store_payment_method: r.desc_store_payment_method ?? null,
    desc_store_bank_account: r.desc_store_bank_account ?? null,
    provider_trade_name: r.provider_trade_name ?? null,
    notes: r.notes ?? null,
    raw_payload: r,
    saipos_synced_at: new Date().toISOString(),
  };
}

// ----------------------------------------------------
// Upsert helpers — chunked to avoid huge payloads
// ----------------------------------------------------
export async function upsertChunked(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
  pkColumn: string,
  chunkSize = 250,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: pkColumn });
    if (error) throw error;
    total += chunk.length;
  }
  return total;
}

// ----------------------------------------------------
// Sync one window for one endpoint
// ----------------------------------------------------
export async function syncWindow(
  supabase: SupabaseClient,
  endpoint: Endpoint,
  start: Date,
  end: Date,
  runType: string,
  dateColumn?: string,
): Promise<{ received: number; upserted: number; runId: number }> {
  const cfg = ENDPOINTS[endpoint];
  const col = dateColumn ?? cfg.defaultDateColumn;
  const startedAt = Date.now();
  const runId = await startSyncRun(supabase, {
    runType,
    endpoint,
    dateColumn: col,
    periodStart: start,
    periodEnd: end,
  });

  try {
    const { records, status } = await fetchAllPages(endpoint, col, start, end);
    let rows: Record<string, any>[] = [];
    if (endpoint === "sales") rows = records.map(mapSale);
    else if (endpoint === "sales_items") rows = records.flatMap(mapSaleItems);
    else if (endpoint === "sales_status_histories") rows = records.flatMap(mapStatusHistories);
    else if (endpoint === "financial") rows = records.map(mapFinancial);

    rows = rows.filter((r) => r[cfg.pkColumn] != null);
    const upserted = rows.length > 0
      ? await upsertChunked(supabase, cfg.table, rows, cfg.pkColumn)
      : 0;

    await finishSyncRun(supabase, runId, {
      httpStatus: status,
      received: records.length,
      upserted,
      status: "success",
      startedAt,
    });
    return { received: records.length, upserted, runId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishSyncRun(supabase, runId, {
      received: 0,
      upserted: 0,
      status: "error",
      errorMessage: msg,
      startedAt,
    });
    throw err;
  }
}

// Sync all 4 endpoints for one window
export async function syncAllEndpoints(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  runType: string,
  dateColumn?: string,
): Promise<Record<Endpoint, { received: number; upserted: number }>> {
  const results = {} as Record<Endpoint, { received: number; upserted: number }>;
  for (const ep of Object.keys(ENDPOINTS) as Endpoint[]) {
    // Financial endpoint uses 'updated_at' too (works for that endpoint per docs)
    try {
      const r = await syncWindow(supabase, ep, start, end, runType, dateColumn);
      results[ep] = { received: r.received, upserted: r.upserted };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[ep] = { received: 0, upserted: 0, error: msg } as any;
    }
  }
  return results;
}
