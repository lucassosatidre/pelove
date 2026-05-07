// Import-dre-gerencial
// Recebe linhas pré-parseadas do XLSX "DRE Gerencial" do Saipos.
// Estratégia: substituição completa por (period_year, period_month).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SnapshotRow {
  period_year: number;
  period_month: number;
  line_label: string;
  line_label_clean: string;
  level: number;
  parent_label: string | null;
  line_type: "section" | "deduction" | "total" | "item";
  amount: number | null;
  pct: number | null;
  ord: number;
}

interface ImportRequest {
  filename: string;
  periods: Array<{ year: number; month: number }>;
  rows: SnapshotRow[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body: ImportRequest = await req.json();

    if (!body.rows?.length || !body.periods?.length) {
      return new Response(JSON.stringify({ error: "Empty rows or periods" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria registro de import
    const periodKeys = body.periods.map((p) =>
      `${p.year}-${String(p.month).padStart(2, "0")}`
    );
    const { data: imp, error: impErr } = await supabase
      .from("dre_snapshot_imports")
      .insert({
        filename: body.filename,
        periods_imported: periodKeys,
        imported_by: userData.user.id,
      })
      .select()
      .single();
    if (impErr || !imp) {
      throw new Error(`Failed to create import record: ${impErr?.message}`);
    }

    // Conta quantas linhas existiam (pra log) e deleta períodos que serão substituídos
    let rowsReplaced = 0;
    for (const p of body.periods) {
      const { count } = await supabase
        .from("dre_snapshot")
        .select("id", { count: "exact", head: true })
        .eq("period_year", p.year)
        .eq("period_month", p.month);
      rowsReplaced += count ?? 0;
      await supabase
        .from("dre_snapshot")
        .delete()
        .eq("period_year", p.year)
        .eq("period_month", p.month);
    }

    // Insert batch (com import_id)
    const prepared = body.rows.map((r) => ({
      ...r,
      import_id: imp.id,
    }));

    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < prepared.length; i += BATCH) {
      const chunk = prepared.slice(i, i + BATCH);
      const { error } = await supabase.from("dre_snapshot").insert(chunk);
      if (error) {
        throw new Error(`Insert batch ${i} failed: ${error.message}`);
      }
      inserted += chunk.length;
    }

    await supabase
      .from("dre_snapshot_imports")
      .update({
        rows_inserted: inserted,
        rows_replaced: rowsReplaced,
      })
      .eq("id", imp.id);

    return new Response(
      JSON.stringify({
        success: true,
        import_id: imp.id,
        periods: periodKeys,
        rows_inserted: inserted,
        rows_replaced: rowsReplaced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("import-dre-gerencial error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
