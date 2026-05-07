-- =====================================================
-- DRE v2 — RPC pra buscar múltiplos períodos de uma vez
-- =====================================================
-- Permite a UI ver Nov/24, Dez/24, Jan/25 lado a lado em colunas.
-- Aceita array JSON: [{"year": 2024, "month": 11}, {"year": 2024, "month": 12}, ...]
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dre_snapshot_multi(p_periods jsonb)
RETURNS TABLE (
  period_year int,
  period_month int,
  ord int,
  line_label text,
  line_label_clean text,
  level int,
  parent_label text,
  line_type text,
  amount numeric,
  pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.period_year,
    s.period_month,
    s.ord,
    s.line_label,
    s.line_label_clean,
    s.level,
    s.parent_label,
    s.line_type,
    s.amount,
    s.pct
  FROM dre_snapshot s
  JOIN jsonb_array_elements(p_periods) AS p(elem)
    ON s.period_year = (p.elem->>'year')::int
   AND s.period_month = (p.elem->>'month')::int
  ORDER BY s.ord, s.period_year, s.period_month;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_snapshot_multi(jsonb) TO authenticated;
