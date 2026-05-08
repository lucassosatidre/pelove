-- advisor_app_events: registro leve de eventos do app que o Advisor consulta
-- como contexto adicional. Cobre principalmente navegação (page views) e
-- pode receber notas/ações relevantes do front.

CREATE TABLE IF NOT EXISTS public.advisor_app_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  route TEXT,
  kind TEXT NOT NULL DEFAULT 'navigation', -- 'navigation' | 'mutation' | 'note'
  summary TEXT,
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_advisor_app_events_user_time
  ON public.advisor_app_events (user_id, occurred_at DESC);

ALTER TABLE public.advisor_app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own events"
  ON public.advisor_app_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own events"
  ON public.advisor_app_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own events"
  ON public.advisor_app_events FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.advisor_app_events IS
  'Stream leve de eventos do app (navegação e ações relevantes) usado pelo Advisor para construir contexto além das mensagens de chat.';
