// Sync one window for one or more endpoints.
// POST { start: ISO, end: ISO, endpoints?: string[], runType?: string, dateColumn?: string }
//
// Used by:
//   - saipos-historical-backfill (delegates per window)
//   - the "Atualizar agora" button in the UI
//   - manual debugging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getServiceClient,
  syncAllEndpoints,
  syncWindow,
  ENDPOINTS,
  Endpoint,
} from "../_shared/saipos.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const startStr = body.start;
    const endStr = body.end;
    if (!startStr || !endStr) {
      return new Response(
        JSON.stringify({ error: "start and end are required (ISO datetime)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(
        JSON.stringify({ error: "invalid start/end" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endpoints: Endpoint[] = Array.isArray(body.endpoints) && body.endpoints.length > 0
      ? body.endpoints.filter((e: string) => e in ENDPOINTS)
      : (Object.keys(ENDPOINTS) as Endpoint[]);
    const runType = String(body.runType ?? "manual");
    const dateColumn = body.dateColumn ? String(body.dateColumn) : undefined;

    const supabase = getServiceClient();
    const results: Record<string, any> = {};

    if (endpoints.length === Object.keys(ENDPOINTS).length) {
      const all = await syncAllEndpoints(supabase, start, end, runType, dateColumn);
      Object.assign(results, all);
    } else {
      for (const ep of endpoints) {
        try {
          const r = await syncWindow(supabase, ep, start, end, runType, dateColumn);
          results[ep] = { received: r.received, upserted: r.upserted };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results[ep] = { received: 0, upserted: 0, error: msg };
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, start: startStr, end: endStr, runType, results }),
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
