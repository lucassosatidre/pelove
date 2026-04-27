// Cron entry point. Called by pg_cron via pg_net.
//
// Modes (passed as ?mode=...):
//   - incremental    → last 2 hours by updated_at (every 30min, business hours)
//   - daily          → last 7 days by updated_at (1x/day at 04h)
//   - old_data_check → last N days by updated_at (1x/week, N from config)
//
// All modes call the same syncAllEndpoints helper but with different windows.
// Skipped silently if backfill is not yet completed (avoids stomping the
// historical load that's still running).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getServiceClient,
  syncAllEndpoints,
} from "../_shared/saipos.ts";

type Mode = "incremental" | "daily" | "old_data_check";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") ?? "incremental") as Mode;

    const supabase = getServiceClient();

    const { data: cfg } = await supabase
      .from("saipos_config")
      .select("*")
      .limit(1)
      .single();
    if (!cfg) throw new Error("saipos_config row missing");

    if (!cfg.is_enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Saipos integration disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!cfg.backfill_completed_at) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Historical backfill not complete yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    let start: Date;

    switch (mode) {
      case "incremental":
        start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        break;
      case "daily":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "old_data_check": {
        if (!cfg.old_data_check_enabled) {
          return new Response(
            JSON.stringify({ skipped: true, reason: "old_data_check disabled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const days = Math.max(1, Math.min(365, cfg.old_data_check_window_days ?? 90));
        start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Saipos limits each request to 15-day windows. Slice if needed.
    const MAX_DAYS_PER_WINDOW = 14;
    const ms = MAX_DAYS_PER_WINDOW * 24 * 60 * 60 * 1000;

    const allResults: any[] = [];
    let cursor = start;
    while (cursor < now) {
      const winEnd = new Date(Math.min(cursor.getTime() + ms, now.getTime()));
      const r = await syncAllEndpoints(supabase, cursor, winEnd, mode);
      allResults.push({ start: cursor.toISOString(), end: winEnd.toISOString(), ...r });
      cursor = winEnd;
    }

    // Update last_*_sync_at on config
    const updateField =
      mode === "incremental" ? { last_incremental_sync_at: new Date().toISOString() }
      : mode === "daily" ? { last_daily_sync_at: new Date().toISOString() }
      : { last_old_data_check_at: new Date().toISOString() };

    await supabase.from("saipos_config").update(updateField).eq("id", cfg.id);

    return new Response(
      JSON.stringify({ success: true, mode, windows: allResults.length, results: allResults }),
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
