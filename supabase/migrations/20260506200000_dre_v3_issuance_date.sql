-- =====================================================
-- DRE v3 — Trocar regime de pagamento → regime de competência (issuance_date)
-- =====================================================
-- O Saipos usa issuance_date (data de emissão do documento) como base
-- do DRE Gerencial. Validação contra Fev/26:
--   * Icms - Credito Presumido: payment 22.567 vs Saipos 17.554 vs issuance 17.554 ✓
--   * Pis e Cofins:             payment  8.581 vs Saipos      0 vs issuance      0 ✓
--   * Simples Nacional:         payment 39.813 vs Saipos 34.174 vs issuance 34.174 ✓
--   * Pró-Labore:               payment 86.256 vs Saipos 59.050 vs issuance 59.050 ✓
--
-- Mudança: trocar COALESCE(payment_date, date) →
--                 COALESCE(issuance_date, date, payment_date)
-- nas 3 funções: get_dre_summary, get_dre_expenses_by_group,
-- get_dre_monthly_evolution.
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
      public.dre_classify_category(desc_store_category_financial) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::numeric AS income_amount
    FROM saipos_financial
    WHERE COALESCE(issuance_date, date, payment_date)::date >= p_start
      AND COALESCE(issuance_date, date, payment_date)::date <= p_end
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
      public.dre_classify_category(desc_store_category_financial) AS dre_group,
      COALESCE(NULLIF(TRIM(desc_store_category_financial), ''), '(sem categoria)') AS category,
      -amount AS expense_amount,
      paid
    FROM saipos_financial
    WHERE COALESCE(issuance_date, date, payment_date)::date >= p_start
      AND COALESCE(issuance_date, date, payment_date)::date <= p_end
      AND amount < 0
  ),
  agg AS (
    SELECT
      dre_group,
      category,
      COALESCE(SUM(expense_amount), 0)::numeric AS amount_total,
      COUNT(*)::bigint AS txn_count,
      COALESCE(SUM(CASE WHEN paid IS TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS paid_amount,
      COALESCE(SUM(CASE WHEN paid IS NOT TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS unpaid_amount
    FROM base
    GROUP BY dre_group, category
  ),
  group_totals AS (
    SELECT dre_group, NULLIF(SUM(amount_total), 0) AS group_total FROM agg GROUP BY dre_group
  )
  SELECT
    a.dre_group,
    a.category,
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
      date_trunc('month', COALESCE(issuance_date, date, payment_date))::date AS month_bucket,
      public.dre_classify_category(desc_store_category_financial) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount
    FROM saipos_financial
    WHERE COALESCE(issuance_date, date, payment_date)::date >= p_start
      AND COALESCE(issuance_date, date, payment_date)::date <= p_end
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
