
-- Tabela de logs de ferramentas MCP
CREATE TABLE IF NOT EXISTS public.clau_tool_logs (
  id BIGSERIAL PRIMARY KEY,
  caller TEXT NOT NULL DEFAULT 'openclaw',
  tool_name TEXT NOT NULL,
  args JSONB,
  status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  duration_ms INTEGER,
  result_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clau_tool_logs_created_at
  ON public.clau_tool_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clau_tool_logs_caller
  ON public.clau_tool_logs (caller, created_at DESC);

ALTER TABLE public.clau_tool_logs ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados (admins) podem ler logs.
CREATE POLICY "Authenticated read clau_tool_logs"
  ON public.clau_tool_logs FOR SELECT TO authenticated USING (true);

-- Inserts feitos pela edge function via service_role (bypass de RLS).
-- Função run_sql_select: executa SOMENTE consultas SELECT.
-- SECURITY INVOKER => roda com permissões do chamador (service_role na edge function).
CREATE OR REPLACE FUNCTION public.run_sql_select(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_result JSONB;
BEGIN
  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN
    RAISE EXCEPTION 'SQL vazio';
  END IF;

  v_normalized := lower(regexp_replace(trim(p_sql), '\s+', ' ', 'g'));
  -- remove ponto-e-vírgula final
  v_normalized := regexp_replace(v_normalized, ';\s*$', '');

  -- Bloquear múltiplos statements
  IF position(';' in v_normalized) > 0 THEN
    RAISE EXCEPTION 'Múltiplos statements não são permitidos';
  END IF;

  -- Deve começar com SELECT ou WITH
  IF v_normalized !~ '^(select|with)\s' THEN
    RAISE EXCEPTION 'Apenas SELECT/WITH são permitidos';
  END IF;

  -- Bloquear palavras-chave de escrita / DDL
  IF v_normalized ~* '\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|analyze|reindex|cluster|listen|notify|lock|do|call|merge|refresh|reset|set|begin|commit|rollback|savepoint|prepare|execute|deallocate|fetch|move|close|discard|security|invoke|into)\b' THEN
    RAISE EXCEPTION 'Palavra-chave de escrita ou DDL detectada';
  END IF;

  -- Forçar limite máximo razoável: envolvemos em uma subquery com LIMIT
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) AS t LIMIT 1000',
    p_sql
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- EXECUTE restrito a service_role
REVOKE ALL ON FUNCTION public.run_sql_select(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_sql_select(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_sql_select(TEXT) TO service_role;
