// Advisor chat — main orchestration
//
// Flow:
//   1. Validate auth (the user calling must be logged in)
//   2. Resolve conversation_id (create if missing)
//   3. Save user message
//   4. Build full context (system prompt with map + KPIs + facts)
//   5. Load conversation history
//   6. Call Claude with tools enabled
//   7. If Claude returns tool_use, execute tools and loop
//   8. Save final assistant message
//   9. Return assistant text + usage stats
//
// POST { message: string, conversation_id?: string, model?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AnthropicMessage, AnthropicContentBlock, AnthropicTextBlock, AnthropicToolUseBlock,
  callAnthropic, extractText, extractToolUses, DEFAULT_MODEL,
} from "../_shared/anthropic.ts";
import { buildAdvisorContext } from "../_shared/context.ts";
import { ADVISOR_TOOLS, executeTool } from "../_shared/tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TOOL_LOOPS = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(401, "Missing Authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // userClient validates the JWT to identify the caller
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonError(401, "Invalid auth");
    }
    const userId = userData.user.id;

    // serviceClient bypasses RLS — used for inserts/reads we control
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const userMessage = String(body?.message ?? "").trim();
    if (!userMessage) return jsonError(400, "message is required");

    let conversationId: string | null = body?.conversation_id ?? null;
    const model = String(body?.model ?? DEFAULT_MODEL);

    // -----------------------------------------------------
    // Resolve / create conversation
    // -----------------------------------------------------
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from("advisor_conversations")
        .insert({ user_id: userId, title: userMessage.substring(0, 60) })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = conv!.id as string;
    } else {
      // Make sure it belongs to the user
      const { data: conv } = await supabase
        .from("advisor_conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .single();
      if (!conv || conv.user_id !== userId) {
        return jsonError(403, "Conversation not yours");
      }
    }

    // -----------------------------------------------------
    // Save user message
    // -----------------------------------------------------
    await supabase.from("advisor_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: { text: userMessage },
    });

    // -----------------------------------------------------
    // Build context
    // -----------------------------------------------------
    const ctx = await buildAdvisorContext(supabase, userId);

    // -----------------------------------------------------
    // Load conversation history (chronological)
    // -----------------------------------------------------
    const { data: historyRows } = await supabase
      .from("advisor_messages")
      .select("role, content, tool_calls, tool_results, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const messages: AnthropicMessage[] = [];
    for (const row of (historyRows ?? []) as any[]) {
      if (row.role === "user") {
        messages.push({ role: "user", content: String(row.content?.text ?? "") });
      } else if (row.role === "assistant") {
        // Reconstruct content blocks: text + tool_use
        const blocks: AnthropicContentBlock[] = [];
        const text = String(row.content?.text ?? "");
        if (text) blocks.push({ type: "text", text } as AnthropicTextBlock);
        if (Array.isArray(row.tool_calls)) {
          for (const tc of row.tool_calls) {
            blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
          }
        }
        if (blocks.length > 0) {
          messages.push({ role: "assistant", content: blocks });
        }
        if (Array.isArray(row.tool_results) && row.tool_results.length > 0) {
          messages.push({
            role: "user",
            content: row.tool_results.map((tr: any) => ({
              type: "tool_result",
              tool_use_id: tr.tool_use_id,
              content: tr.content,
              is_error: tr.is_error ?? false,
            })),
          });
        }
      }
    }

    // -----------------------------------------------------
    // Tool-use loop
    // -----------------------------------------------------
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    let totalCacheCreate = 0;
    let finalText = "";
    let lastModel = model;
    let lastStopReason: string | null = null;

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const resp = await callAnthropic({
        model,
        system: [
          // Mark the system block as cacheable — this lets us reuse the heavy
          // context (map + KPIs + facts) across messages without paying for it
          // on every call. Cache TTL is ~5min on the Anthropic side.
          { type: "text", text: ctx.systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        messages,
        tools: ADVISOR_TOOLS,
        max_tokens: 4096,
        metadata: { user_id: userId },
      });

      lastModel = resp.model;
      lastStopReason = resp.stop_reason;
      totalInputTokens += resp.usage.input_tokens ?? 0;
      totalOutputTokens += resp.usage.output_tokens ?? 0;
      totalCacheRead += resp.usage.cache_read_input_tokens ?? 0;
      totalCacheCreate += resp.usage.cache_creation_input_tokens ?? 0;

      const toolUses = extractToolUses(resp.content);
      const text = extractText(resp.content);

      if (text) finalText = text;

      if (toolUses.length === 0 || resp.stop_reason !== "tool_use") {
        // Save final assistant message with text
        await supabase.from("advisor_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: { text },
          model: lastModel,
          input_tokens: resp.usage.input_tokens,
          output_tokens: resp.usage.output_tokens,
          cache_read_input_tokens: resp.usage.cache_read_input_tokens,
          cache_creation_input_tokens: resp.usage.cache_creation_input_tokens,
          stop_reason: resp.stop_reason,
        });
        break;
      }

      // Execute each tool call
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const r = await executeTool(supabase, userId, tu.name, tu.input);
        toolResults.push({
          tool_use_id: tu.id,
          content: r.result,
          is_error: r.isError,
        });
      }

      // Save assistant turn (with tool calls + results) so reload reconstructs correctly
      await supabase.from("advisor_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: { text },
        model: lastModel,
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        cache_read_input_tokens: resp.usage.cache_read_input_tokens,
        cache_creation_input_tokens: resp.usage.cache_creation_input_tokens,
        stop_reason: resp.stop_reason,
        tool_calls: toolUses.map((tu) => ({ id: tu.id, name: tu.name, input: tu.input })),
        tool_results: toolResults,
      });

      // Append assistant's content (text + tool_use) and tool_result back to messages, then loop
      const assistantBlocks: AnthropicContentBlock[] = [];
      if (text) assistantBlocks.push({ type: "text", text });
      assistantBlocks.push(...(toolUses as AnthropicContentBlock[]));
      messages.push({ role: "assistant", content: assistantBlocks });
      messages.push({
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          is_error: tr.is_error,
        })),
      });
    }

    // -----------------------------------------------------
    // Update conversation totals
    // -----------------------------------------------------
    const { data: countRow } = await supabase
      .from("advisor_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    void countRow;

    await supabase.from("advisor_conversations").update({
      last_message_at: new Date().toISOString(),
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
    }).eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversationId,
        text: finalText || "(sem resposta)",
        model: lastModel,
        stop_reason: lastStopReason,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          cache_read_input_tokens: totalCacheRead,
          cache_creation_input_tokens: totalCacheCreate,
        },
        context: {
          has_map_data: ctx.hasMapData,
          has_sales_data: ctx.hasSalesData,
          facts_count: ctx.factsCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[advisor-chat] error:", msg);
    return jsonError(500, msg);
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
