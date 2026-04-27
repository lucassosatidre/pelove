// Historical backfill orchestrator.
//
// Processes a small batch of pending 14-day windows per invocation
// (edge function timeout safety). Caller invokes repeatedly (UI polling
// or cron) until the response says { done: true }.
//
// State lives in two tables:
//   - saipos_config.backfill_start_date / backfill_completed_at
//   - saipos_backfill_progress (one row per window per endpoint)
//
// POST { maxWindows?: number, throttleMs?: number }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getServiceClient,
  syncWindow,
  ENDPOINTS,
  Endpoint,
} from "../_shared/saipos.ts";

const WINDOW_DAYS = 14;
const ENDPOINT_LIST: Endpoint[] = ["sales", "sales_items", "sales_status_histories", "financial"];

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const maxWindows = Math.min(Math.max(Number(body.maxWindows) || 2, 1), 6);
    const throttleMs = Math.max(Number(body.throttleMs) || 1500, 500);

    const supabase = getServiceClient();

    // Load config
    const { data: cfg, error: cfgErr } = await supabase
      .from("saipos_config")
      .select("*")
      .limit(1)
      .single();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("saipos_config row missing");

    if (cfg.backfill_completed_at) {
      return new Response(
        JSON.stringify({ done: true, message: "Backfill already completed", completedAt: cfg.backfill_completed_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Make sure all windows are seeded in saipos_backfill_progress.
    // Cheap idempotent: count existing pending+success+error vs expected.
    const startDate = parseDate(cfg.backfill_start_date as string);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { count: existing } = await supabase
      .from("saipos_backfill_progress")
      .select("id", { count: "exact", head: true });

    if ((existing ?? 0) === 0) {
      // Seed: generate all windows × endpoints
      const seed: any[] = [];
      let cursor = new Date(startDate);
      while (cursor < today) {
        const winEnd = addDays(cursor, WINDOW_DAYS);
        const realEnd = winEnd > today ? today : winEnd;
        for (const ep of ENDPOINT_LIST) {
          seed.push({
            endpoint: ep,
            window_start: fmtDate(cursor),
            window_end: fmtDate(realEnd),
            status: "pending",
          });
        }
        cursor = realEnd;
      }
      // Chunked insert (200 at a time)
      for (let i = 0; i < seed.length; i += 200) {
        const chunk = seed.slice(i, i + 200);
        const { error } = await supabase.from("saipos_backfill_progress").insert(chunk);
        if (error) throw error;
      }
    }

    // Fetch next pending windows (oldest first)
    const { data: pending, error: pErr } = await supabase
      .from("saipos_backfill_progress")
      .select("*")
      .in("status", ["pending", "error"])
      .order("window_start", { ascending: true })
      .order("endpoint", { ascending: true })
      .limit(maxWindows);
    if (pErr) throw pErr;

    if (!pending || pending.length === 0) {
      // Mark backfill done
      await supabase
        .from("saipos_config")
        .update({ backfill_completed_at: new Date().toISOString() })
        .eq("id", cfg.id);
      return new Response(
        JSON.stringify({ done: true, message: "Backfill completed (no more pending windows)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const processed: any[] = [];
    for (const w of pending) {
      const start = parseDate(w.window_start);
      const end = parseDate(w.window_end);

      await supabase
        .from("saipos_backfill_progress")
        .update({ status: "running", attempted_at: new Date().toISOString() })
        .eq("id", w.id);

      try {
        const r = await syncWindow(
          supabase,
          w.endpoint as Endpoint,
          start,
          end,
          "backfill",
          // For historical backfill use shift_date for sales-related, date for financial
          (w.endpoint === "financial") ? "date" : "shift_date",
        );
        await supabase
          .from("saipos_backfill_progress")
          .update({
            status: "success",
            records_imported: r.upserted,
            completed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", w.id);
        processed.push({ id: w.id, endpoint: w.endpoint, window: `${w.window_start} → ${w.window_end}`, upserted: r.upserted });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("saipos_backfill_progress")
          .update({ status: "error", error_message: msg })
          .eq("id", w.id);
        processed.push({ id: w.id, endpoint: w.endpoint, window: `${w.window_start} → ${w.window_end}`, error: msg });
      }

      // Throttle between calls so we don't hit Saipos rate limit (500 / 5min)
      await new Promise((r) => setTimeout(r, throttleMs));
    }

    // Stats
    const { count: totalCount } = await supabase
      .from("saipos_backfill_progress")
      .select("id", { count: "exact", head: true });
    const { count: doneCount } = await supabase
      .from("saipos_backfill_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "success");
    const { count: errCount } = await supabase
      .from("saipos_backfill_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "error");
    const { count: pendCount } = await supabase
      .from("saipos_backfill_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return new Response(
      JSON.stringify({
        done: false,
        processed,
        progress: { total: totalCount, success: doneCount, errors: errCount, pending: pendCount },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
