// Import-financeiro-xlsx
// Recebe linhas pré-parseadas do XLSX "Financeiro" do Saipos e insere
// em saipos_financial_manual com dedup via hash.
//
// Body: {
//   filename: string,
//   period_start: "YYYY-MM-DD",
//   period_end: "YYYY-MM-DD",
//   rows: [{ category, description, amount, date, payment_date?, issuance_date?, paid?, payment_method?, fornecedor?, raw_row }]
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ImportRow {
  category: string;
  description?: string | null;
  amount: number;
  date: string;
  payment_date?: string | null;
  issuance_date?: string | null;
  paid?: boolean | null;
  payment_method?: string | null;
  fornecedor?: string | null;
  raw_row?: Record<string, unknown>;
}

interface ImportRequest {
  filename: string;
  period_start: string;
  period_end: string;
  rows: ImportRow[];
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth
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

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Empty rows" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria registro de import
    const { data: imp, error: impErr } = await supabase
      .from("saipos_financial_imports")
      .insert({
        filename: body.filename,
        period_start: body.period_start,
        period_end: body.period_end,
        rows_total: body.rows.length,
        imported_by: userData.user.id,
      })
      .select()
      .single();
    if (impErr || !imp) {
      throw new Error(`Failed to create import record: ${impErr?.message}`);
    }

    // Prepara linhas com hash
    const prepared = await Promise.all(
      body.rows.map(async (r) => {
        const hashInput = [
          (r.category ?? "").trim(),
          (r.description ?? "").trim(),
          Number(r.amount).toFixed(2),
          r.date,
        ].join("|");
        const unique_hash = await sha256(hashInput);
        return {
          category: r.category,
          description: r.description ?? null,
          amount: Number(r.amount),
          date: r.date,
          payment_date: r.payment_date ?? null,
          issuance_date: r.issuance_date ?? null,
          paid: r.paid ?? true,
          payment_method: r.payment_method ?? null,
          fornecedor: r.fornecedor ?? null,
          import_id: imp.id,
          source: "xlsx_financeiro",
          unique_hash,
          raw_row: r.raw_row ?? r,
        };
      }),
    );

    // Insert em batches com ON CONFLICT DO NOTHING (via upsert ignoreDuplicates)
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < prepared.length; i += BATCH) {
      const chunk = prepared.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("saipos_financial_manual")
        .upsert(chunk, { onConflict: "unique_hash", ignoreDuplicates: true })
        .select("id");
      if (error) {
        throw new Error(`Insert batch ${i} failed: ${error.message}`);
      }
      inserted += data?.length ?? 0;
    }

    const skipped = prepared.length - inserted;
    const total_amount = prepared.reduce((s, r) => s + r.amount, 0);

    // Atualiza log
    await supabase
      .from("saipos_financial_imports")
      .update({
        rows_inserted: inserted,
        rows_skipped_duplicate: skipped,
        total_amount,
      })
      .eq("id", imp.id);

    return new Response(
      JSON.stringify({
        success: true,
        import_id: imp.id,
        rows_total: prepared.length,
        rows_inserted: inserted,
        rows_skipped_duplicate: skipped,
        total_amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("import-financeiro-xlsx error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
