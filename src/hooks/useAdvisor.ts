import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPA = supabase as any;

export interface Conversation {
  id: string;
  title: string | null;
  pinned: boolean;
  archived: boolean;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: { text?: string };
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_input_tokens: number | null;
  tool_calls: any[] | null;
  tool_results: any[] | null;
  stop_reason: string | null;
  created_at: string;
}

export interface AdvisorFact {
  id: string;
  topic: string;
  fact: string;
  user_confirmed: boolean;
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvisorInsight {
  id: string;
  for_date: string;
  severity: "info" | "success" | "warning" | "critical";
  domain: string;
  title: string;
  body: string;
  metadata: any;
  dismissed: boolean;
  created_at: string;
}

// -----------------------------------------------------
export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ["advisor", "conversations"],
    queryFn: async () => {
      const { data, error } = await SUPA.from("advisor_conversations")
        .select("*")
        .eq("archived", false)
        .order("pinned", { ascending: false })
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery<Message[]>({
    queryKey: ["advisor", "messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await SUPA.from("advisor_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    enabled: !!conversationId,
  });
}

// -----------------------------------------------------
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<
    { conversation_id: string; text: string; usage: any; context: any },
    Error,
    { message: string; conversationId?: string | null; model?: string }
  >({
    mutationFn: async ({ message, conversationId, model }) => {
      const { data, error } = await supabase.functions.invoke("advisor-chat", {
        body: { message, conversation_id: conversationId ?? null, model },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["advisor", "messages", data.conversation_id] });
      qc.invalidateQueries({ queryKey: ["advisor", "conversations"] });
      qc.invalidateQueries({ queryKey: ["advisor", "facts"] });
    },
  });
}

// -----------------------------------------------------
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (conversationId) => {
      const { error } = await SUPA.from("advisor_conversations").delete().eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor", "conversations"] });
    },
  });
}

// -----------------------------------------------------
export function useFacts() {
  return useQuery<AdvisorFact[]>({
    queryKey: ["advisor", "facts"],
    queryFn: async () => {
      const { data, error } = await SUPA.from("advisor_facts")
        .select("*")
        .order("topic")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdvisorFact[];
    },
  });
}

export function useDeleteFact() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (factId) => {
      const { error } = await SUPA.from("advisor_facts").delete().eq("id", factId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "facts"] }),
  });
}

export function useConfirmFact() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (factId) => {
      const { error } = await SUPA.from("advisor_facts")
        .update({ user_confirmed: true })
        .eq("id", factId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "facts"] }),
  });
}

// -----------------------------------------------------
export function useInsights() {
  return useQuery<AdvisorInsight[]>({
    queryKey: ["advisor", "insights"],
    queryFn: async () => {
      const { data, error } = await SUPA.from("advisor_insights")
        .select("*")
        .eq("dismissed", false)
        .order("for_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AdvisorInsight[];
    },
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await SUPA.from("advisor_insights")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "insights"] }),
  });
}

export function useGenerateInsightsNow() {
  const qc = useQueryClient();
  return useMutation<any, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("advisor-generate-insights");
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "insights"] }),
  });
}
