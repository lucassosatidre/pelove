// Wrapper around the Anthropic Messages API with prompt caching support.
// Uses Claude Sonnet 4.6 by default — best price/performance for chat.
// Switch to Claude Opus 4.7 for hard reasoning tasks via the `model` arg.

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const HEAVY_MODEL = "claude-opus-4-7";

export interface AnthropicTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}

export interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | AnthropicTextBlock[];
  is_error?: boolean;
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: any;
  cache_control?: { type: "ephemeral" };
}

export interface AnthropicCreateRequest {
  model?: string;
  system?: string | AnthropicTextBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  max_tokens?: number;
  temperature?: number;
  metadata?: { user_id?: string };
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface AnthropicCreateResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

export function getAnthropicKey(): string {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "Anthropic key not set: define ANTHROPIC_API_KEY as edge function secret",
    );
  }
  return key.trim();
}

export async function callAnthropic(req: AnthropicCreateRequest): Promise<AnthropicCreateResponse> {
  const body = {
    model: req.model ?? DEFAULT_MODEL,
    max_tokens: req.max_tokens ?? 4096,
    messages: req.messages,
    ...(req.system != null ? { system: req.system } : {}),
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
    ...(req.temperature != null ? { temperature: req.temperature } : {}),
    ...(req.metadata ? { metadata: req.metadata } : {}),
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getAnthropicKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${text.substring(0, 800)}`);
  }
  try {
    return JSON.parse(text) as AnthropicCreateResponse;
  } catch {
    throw new Error(`Anthropic API returned non-JSON: ${text.substring(0, 200)}`);
  }
}

// Helper: extract plain text from an assistant message's content blocks
export function extractText(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Helper: extract tool_use blocks (for the next iteration of the loop)
export function extractToolUses(blocks: AnthropicContentBlock[]): AnthropicToolUseBlock[] {
  return blocks.filter((b): b is AnthropicToolUseBlock => b.type === "tool_use");
}
