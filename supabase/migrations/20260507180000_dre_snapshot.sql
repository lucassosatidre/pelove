-- =====================================================
-- DRE v2 — snapshot do "DRE Gerencial" do Saipos
-- =====================================================
-- Lucas exporta o XLSX "DRE Gerencial" do Saipos. O app armazena cada
-- linha (mantendo hierarquia, indentação, totais e %) e exibe idêntico
-- ao Saipos. Zero divergência.
--
-- Estratégia de re-import: substituição completa do período. Se o user
-- re-importar o mesmo mês, deleta as linhas antigas e insere as novas.
-- =====================================================

CREATE TABLE public.dre_snapshot (
  id bigserial PRIMARY KEY,

  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),

  -- Estrutura hierárquica preservada
  line_label text NOT NULL,           -- com indentação original (espaços à esquerda)
  line_label_clean text NOT NULL,     -- sem indent, normalizado pra busca
  level int NOT NULL DEFAULT 0,       -- 0=top, 1=4spaces, 2=8spaces, 3=12spaces
  parent_label text,                  -- label clean da linha pai
  line_type text NOT NULL DEFAULT 'item',  -- 'section' (+), 'deduction' (-), 'total' (=), 'item'

  amount numeric(14, 2),
  pct numeric(10, 4),

  ord int NOT NULL,                   -- ordem original no XLSX (1-based)

  import_id uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dre_snap_period ON public.dre_snapshot(period_year, period_month, ord);
CREATE INDEX idx_dre_snap_label ON public.dre_snapshot(line_label_clean);
CREATE INDEX idx_dre_snap_import ON public.dre_snapshot(import_id);

ALTER TABLE public.dre_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated select dre_snapshot"
ON public.dre_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert dre_snapshot"
ON public.dre_snapshot FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete dre_snapshot"
ON public.dre_snapshot FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------
-- dre_snapshot_imports — log
-- -----------------------------------------------------
CREATE TABLE public.dre_snapshot_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  periods_imported text[] NOT NULL,    -- ['2026-01', '2026-02', ...]
  rows_inserted int NOT NULL DEFAULT 0,
  rows_replaced int NOT NULL DEFAULT 0,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dre_snapshot_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated select dre_snap_imp"
ON public.dre_snapshot_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert dre_snap_imp"
ON public.dre_snapshot_imports FOR INSERT TO authenticated WITH CHECK (true);

-- -----------------------------------------------------
-- get_dre_snapshot: retorna todas as linhas de um período em ordem
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_snapshot(p_year int, p_month int)
RETURNS TABLE (
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
  SELECT ord, line_label, line_label_clean, level, parent_label, line_type, amount, pct
  FROM dre_snapshot
  WHERE period_year = p_year AND period_month = p_month
  ORDER BY ord;
$$;
GRANT EXECUTE ON FUNCTION public.get_dre_snapshot(int, int) TO authenticated;

-- -----------------------------------------------------
-- get_dre_snapshot_periods: meses disponíveis pra seleção na UI
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_snapshot_periods()
RETURNS TABLE (
  period_year int,
  period_month int,
  rows_count bigint,
  imported_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    period_year,
    period_month,
    COUNT(*)::bigint AS rows_count,
    MAX(imported_at) AS imported_at
  FROM dre_snapshot
  GROUP BY period_year, period_month
  ORDER BY period_year DESC, period_month DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_dre_snapshot_periods() TO authenticated;

-- -----------------------------------------------------
-- get_dre_snapshot_imports_log: histórico de uploads
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_snapshot_imports_log(p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  filename text,
  periods_imported text[],
  rows_inserted int,
  rows_replaced int,
  imported_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, filename, periods_imported, rows_inserted, rows_replaced, imported_at
  FROM dre_snapshot_imports
  ORDER BY imported_at DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_dre_snapshot_imports_log(int) TO authenticated;
