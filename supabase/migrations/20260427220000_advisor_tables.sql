-- =====================================================
-- Advisor: AI assistant with persistent memory
-- =====================================================
-- Architecture:
--   - advisor_conversations: one per chat session
--   - advisor_messages: one row per turn (user/assistant/tool)
--   - advisor_facts: long-term facts learned about the business
--   - advisor_insights: daily insights generated in background
-- =====================================================

CREATE TABLE public.advisor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_user ON public.advisor_conversations(user_id, last_message_at DESC) WHERE archived = false;

ALTER TABLE public.advisor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own conversations"
ON public.advisor_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own conversations"
ON public.advisor_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own conversations"
ON public.advisor_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own conversations"
ON public.advisor_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -----------------------------------------------------
CREATE TABLE public.advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.advisor_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content jsonb NOT NULL, -- structured: text or tool_use blocks
  -- For assistant messages: model name used
  model text,
  -- Token usage (for cost tracking)
  input_tokens integer,
  output_tokens integer,
  cache_read_input_tokens integer,
  cache_creation_input_tokens integer,
  -- Tool calls support
  tool_calls jsonb,
  tool_results jsonb,
  -- Stop reason ("end_turn", "tool_use", "max_tokens", etc.)
  stop_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_msg_conv ON public.advisor_messages(conversation_id, created_at);

ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see messages of their conversations"
ON public.advisor_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.advisor_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users insert messages on their conversations"
ON public.advisor_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.advisor_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

-- -----------------------------------------------------
-- Long-term facts the advisor has learned
-- -----------------------------------------------------
CREATE TABLE public.advisor_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Topic/category for grouping (e.g., "operacao", "financeiro", "preferencia")
  topic text NOT NULL DEFAULT 'geral',
  -- The fact itself, in natural language
  fact text NOT NULL,
  -- Where this came from (a conversation_id or 'manual')
  source_conversation_id uuid REFERENCES public.advisor_conversations(id) ON DELETE SET NULL,
  -- Optional: how confident the advisor is (0-1)
  confidence numeric(3, 2) DEFAULT 1.0,
  -- Has the user explicitly approved/edited?
  user_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_facts_user ON public.advisor_facts(user_id, topic);

ALTER TABLE public.advisor_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own facts"
ON public.advisor_facts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own facts"
ON public.advisor_facts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own facts"
ON public.advisor_facts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own facts"
ON public.advisor_facts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- Daily generated insights (cards shown at top of dashboards)
-- -----------------------------------------------------
CREATE TABLE public.advisor_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One insight per business day (the day data refers to, not when generated)
  for_date date NOT NULL,
  -- Severity controls visual presentation
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  -- Domain ('vendas', 'produtos', 'operacao', 'pessoas', 'estrategia')
  domain text NOT NULL DEFAULT 'vendas',
  title text NOT NULL,
  body text NOT NULL,
  -- Optional structured data the UI can use to render extras (numbers, links)
  metadata jsonb,
  -- Has the user dismissed this insight?
  dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  -- Generation provenance
  generated_by text NOT NULL DEFAULT 'cron', -- 'cron' or 'manual'
  generation_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_date ON public.advisor_insights(for_date DESC, dismissed);

ALTER TABLE public.advisor_insights ENABLE ROW LEVEL SECURITY;

-- Insights are global (not per-user) — every authenticated user sees them
CREATE POLICY "Authenticated users see insights"
ON public.advisor_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users dismiss insights"
ON public.advisor_insights FOR UPDATE TO authenticated USING (true);

-- -----------------------------------------------------
-- updated_at trigger for facts
-- -----------------------------------------------------
CREATE TRIGGER trg_advisor_facts_updated_at
BEFORE UPDATE ON public.advisor_facts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
