-- =====================================================
-- DRE — tabela de lançamentos manuais (XLSX import) + RPCs unificadas
-- =====================================================
-- A API do Saipos não entrega:
--   * Linhas-filha de "Acerto com entregadores" (Motoboy individual)
--   * Movimentação de estoque (CMV)
--
-- Solução: Lucas faz upload mensal do XLSX "Financeiro" exportado do
-- Saipos. As linhas que não existem em saipos_financial vão pra
-- saipos_financial_manual e participam dos cálculos do DRE via view
-- unificada.
--
-- Anti-duplicação: hash(category|description|amount|date) único.
-- Re-importar o mesmo Excel não duplica.
-- =====================================================

-- -----------------------------------------------------
-- saipos_financial_manual — lançamentos importados via XLSX
-- -----------------------------------------------------
CREATE TABLE public.saipos_financial_manual (
  id bigserial PRIMARY KEY,

  category text NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL,
  date date NOT NULL,
  payment_date date,
  issuance_date date,
  paid boolean DEFAULT true,
  payment_method text,
  fornecedor text,

  -- Tracking
  import_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'xlsx_financeiro',
  unique_hash text NOT NULL UNIQUE,

  raw_row jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sfm_date ON public.saipos_financial_manual(date);
CREATE INDEX idx_sfm_category ON public.saipos_financial_manual(category);
CREATE INDEX idx_sfm_import ON public.saipos_financial_manual(import_id);

ALTER TABLE public.saipos_financial_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select sfm"
ON public.saipos_financial_manual FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sfm"
ON public.saipos_financial_manual FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete sfm"
ON public.saipos_financial_manual FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_financial_imports — log de uploads
-- -----------------------------------------------------
CREATE TABLE public.saipos_financial_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  period_start date,
  period_end date,
  rows_total integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_skipped_duplicate integer NOT NULL DEFAULT 0,
  total_amount numeric(12, 2),
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saipos_financial_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select imports"
ON public.saipos_financial_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert imports"
ON public.saipos_financial_imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete imports"
ON public.saipos_financial_imports FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------
-- View unificada: API + manual (única fonte de verdade pro DRE)
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.dre_financial_unified AS
SELECT
  desc_store_category_financial AS category,
  desc_store_fin_transaction AS description,
  amount,
  COALESCE(issuance_date::date, date::date, payment_date::date) AS effective_date,
  paid,
  'api'::text AS source
FROM public.saipos_financial
UNION ALL
SELECT
  category,
  description,
  amount,
  COALESCE(issuance_date, date, payment_date) AS effective_date,
  paid,
  'manual'::text AS source
FROM public.saipos_financial_manual;

GRANT SELECT ON public.dre_financial_unified TO authenticated;

-- =====================================================
-- RPCs do DRE atualizadas pra usar a view unificada
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dre_summary(p_start date, p_end date)
RETURNS TABLE (
  gross_revenue numeric,
  total_orders bigint,
  avg_ticket numeric,
  total_taxes numeric,
  net_revenue numeric,
  total_cogs numeric,
  total_sales_cost numeric,
  gross_operating_profit numeric,
  total_admin numeric,
  total_financial_expenses numeric,
  operating_profit numeric,
  non_operational_income numeric,
  profit_before_tax numeric,
  income_tax numeric,
  profit_before_prolabore numeric,
  prolabore numeric,
  net_profit numeric,
  excluded_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT
      COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue,
      COUNT(*)::bigint AS total_orders
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
  ),
  fin AS (
    SELECT
      public.dre_classify_category(category) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::numeric AS income_amount
    FROM public.dre_financial_unified
    WHERE effective_date >= p_start
      AND effective_date <= p_end
    GROUP BY 1
  ),
  agg AS (
    SELECT
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'tax'), 0)::numeric AS total_taxes,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'cogs'), 0)::numeric AS total_cogs,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'sales_cost'), 0)::numeric AS total_sales_cost,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'admin'), 0)::numeric AS total_admin,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'financial'), 0)::numeric AS total_financial_expenses,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'income_tax'), 0)::numeric AS income_tax,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'prolabore'), 0)::numeric AS prolabore,
      COALESCE(SUM(income_amount) FILTER (WHERE grp NOT IN ('exclude')), 0)::numeric AS non_operational_income,
      COALESCE(SUM(expense_amount + income_amount) FILTER (WHERE grp = 'exclude'), 0)::numeric AS excluded_amount
    FROM fin
  )
  SELECT
    s.gross_revenue,
    s.total_orders,
    CASE WHEN s.total_orders > 0 THEN (s.gross_revenue / s.total_orders)::numeric ELSE 0::numeric END AS avg_ticket,
    a.total_taxes,
    (s.gross_revenue - a.total_taxes)::numeric AS net_revenue,
    a.total_cogs,
    a.total_sales_cost,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost)::numeric AS gross_operating_profit,
    a.total_admin,
    a.total_financial_expenses,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses)::numeric AS operating_profit,
    a.non_operational_income,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income)::numeric AS profit_before_tax,
    a.income_tax,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income
      - a.income_tax)::numeric AS profit_before_prolabore,
    a.prolabore,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income
      - a.income_tax - a.prolabore)::numeric AS net_profit,
    a.excluded_amount
  FROM sales s CROSS JOIN agg a;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_summary(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dre_expenses_by_group(p_start date, p_end date)
RETURNS TABLE (
  dre_group text,
  category text,
  amount_total numeric,
  txn_count bigint,
  paid_amount numeric,
  unpaid_amount numeric,
  pct_of_group numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      public.dre_classify_category(category) AS dre_group,
      COALESCE(NULLIF(TRIM(category), ''), '(sem categoria)') AS category_label,
      -amount AS expense_amount,
      paid
    FROM public.dre_financial_unified
    WHERE effective_date >= p_start
      AND effective_date <= p_end
      AND amount < 0
  ),
  agg AS (
    SELECT
      dre_group,
      category_label,
      COALESCE(SUM(expense_amount), 0)::numeric AS amount_total,
      COUNT(*)::bigint AS txn_count,
      COALESCE(SUM(CASE WHEN paid IS TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS paid_amount,
      COALESCE(SUM(CASE WHEN paid IS NOT TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS unpaid_amount
    FROM base
    GROUP BY dre_group, category_label
  ),
  group_totals AS (
    SELECT dre_group, NULLIF(SUM(amount_total), 0) AS group_total FROM agg GROUP BY dre_group
  )
  SELECT
    a.dre_group,
    a.category_label AS category,
    a.amount_total,
    a.txn_count,
    a.paid_amount,
    a.unpaid_amount,
    CASE WHEN gt.group_total IS NULL THEN 0::numeric
      ELSE (a.amount_total / gt.group_total * 100)::numeric
    END AS pct_of_group
  FROM agg a
  LEFT JOIN group_totals gt USING (dre_group)
  ORDER BY a.dre_group, a.amount_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_expenses_by_group(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dre_monthly_evolution(p_start date, p_end date)
RETURNS TABLE (
  month_bucket date,
  gross_revenue numeric,
  net_revenue numeric,
  total_expenses numeric,
  operating_profit numeric,
  net_profit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start::timestamp),
      date_trunc('month', p_end::timestamp),
      interval '1 month'
    )::date AS month_bucket
  ),
  rev AS (
    SELECT
      date_trunc('month', shift_date)::date AS month_bucket,
      COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    GROUP BY 1
  ),
  fin AS (
    SELECT
      date_trunc('month', effective_date)::date AS month_bucket,
      public.dre_classify_category(category) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount
    FROM public.dre_financial_unified
    WHERE effective_date >= p_start
      AND effective_date <= p_end
    GROUP BY 1, 2
  ),
  fin_pivot AS (
    SELECT
      month_bucket,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'tax'), 0)::numeric AS taxes,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'cogs'), 0)::numeric AS cogs,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'sales_cost'), 0)::numeric AS sc,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'admin'), 0)::numeric AS adm,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'financial'), 0)::numeric AS fin_exp,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'income_tax'), 0)::numeric AS irpj,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'prolabore'), 0)::numeric AS prolab
    FROM fin
    GROUP BY 1
  )
  SELECT
    m.month_bucket,
    COALESCE(rev.gross_revenue, 0)::numeric AS gross_revenue,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0))::numeric AS net_revenue,
    (COALESCE(fp.taxes, 0) + COALESCE(fp.cogs, 0) + COALESCE(fp.sc, 0)
      + COALESCE(fp.adm, 0) + COALESCE(fp.fin_exp, 0) + COALESCE(fp.irpj, 0)
      + COALESCE(fp.prolab, 0))::numeric AS total_expenses,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0) - COALESCE(fp.cogs, 0)
      - COALESCE(fp.sc, 0) - COALESCE(fp.adm, 0) - COALESCE(fp.fin_exp, 0))::numeric AS operating_profit,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0) - COALESCE(fp.cogs, 0)
      - COALESCE(fp.sc, 0) - COALESCE(fp.adm, 0) - COALESCE(fp.fin_exp, 0)
      - COALESCE(fp.irpj, 0) - COALESCE(fp.prolab, 0))::numeric AS net_profit
  FROM months m
  LEFT JOIN rev ON rev.month_bucket = m.month_bucket
  LEFT JOIN fin_pivot fp ON fp.month_bucket = m.month_bucket
  ORDER BY m.month_bucket;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_monthly_evolution(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_imports_log: lista de imports recentes (pra UI)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_imports_log(p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  filename text,
  period_start date,
  period_end date,
  rows_total integer,
  rows_inserted integer,
  rows_skipped_duplicate integer,
  total_amount numeric,
  imported_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, filename, period_start, period_end,
    rows_total, rows_inserted, rows_skipped_duplicate,
    total_amount, imported_at
  FROM saipos_financial_imports
  ORDER BY imported_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_imports_log(int) TO authenticated;
