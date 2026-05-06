
-- =========================================================
-- DRE RPCs
-- Convenções:
--   * saipos_financial.amount < 0  => despesa
--   * saipos_financial.amount > 0  => outras receitas
--   * Receita bruta vem de saipos_sales (canceled = false)
--   * Usa COALESCE(payment_date, date) como data de competência
-- =========================================================

-- ---------- get_dre_summary ----------
CREATE OR REPLACE FUNCTION public.get_dre_summary(p_start date, p_end date)
RETURNS TABLE(
  gross_revenue numeric,
  total_discount numeric,
  total_increase numeric,
  delivery_fee_passthrough numeric,
  service_charge_passthrough numeric,
  net_sales_revenue numeric,
  total_orders bigint,
  avg_ticket numeric,
  other_income numeric,
  total_expenses numeric,
  net_result numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH sales AS (
    SELECT
      COALESCE(SUM(total_amount), 0)::numeric             AS gross_revenue,
      COALESCE(SUM(total_discount), 0)::numeric           AS total_discount,
      COALESCE(SUM(total_increase), 0)::numeric           AS total_increase,
      COALESCE(SUM(delivery_fee), 0)::numeric             AS delivery_fee_passthrough,
      COALESCE(SUM(table_total_service_charge), 0)::numeric AS service_charge_passthrough,
      COUNT(*)::bigint                                    AS total_orders
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
  ),
  fin AS (
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric  AS other_income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS total_expenses
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
  )
  SELECT
    s.gross_revenue,
    s.total_discount,
    s.total_increase,
    s.delivery_fee_passthrough,
    s.service_charge_passthrough,
    (s.gross_revenue - s.delivery_fee_passthrough - s.service_charge_passthrough)::numeric AS net_sales_revenue,
    s.total_orders,
    CASE WHEN s.total_orders > 0 THEN (s.gross_revenue / s.total_orders)::numeric ELSE 0 END AS avg_ticket,
    f.other_income,
    f.total_expenses,
    (s.gross_revenue - s.delivery_fee_passthrough - s.service_charge_passthrough + f.other_income - f.total_expenses)::numeric AS net_result
  FROM sales s CROSS JOIN fin f;
$$;

-- ---------- get_dre_revenue_by_channel ----------
CREATE OR REPLACE FUNCTION public.get_dre_revenue_by_channel(p_start date, p_end date)
RETURNS TABLE(channel text, revenue numeric, orders bigint, pct_of_total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(partner_desc), ''),
        CASE id_sale_type
          WHEN 1 THEN 'Entrega'
          WHEN 2 THEN 'Balcão'
          WHEN 3 THEN 'Salão'
          WHEN 4 THEN 'Ficha'
          ELSE 'Outro'
        END) AS channel,
      total_amount
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
  ),
  agg AS (
    SELECT channel,
      COALESCE(SUM(total_amount), 0)::numeric AS revenue,
      COUNT(*)::bigint AS orders
    FROM base GROUP BY channel
  ),
  total AS (SELECT COALESCE(SUM(revenue), 0) AS t FROM agg)
  SELECT a.channel, a.revenue, a.orders,
    CASE WHEN t.t > 0 THEN (a.revenue * 100.0 / t.t)::numeric(6,2) ELSE 0 END AS pct_of_total
  FROM agg a CROSS JOIN total t
  ORDER BY a.revenue DESC;
$$;

-- ---------- get_dre_expenses_by_category ----------
CREATE OR REPLACE FUNCTION public.get_dre_expenses_by_category(p_start date, p_end date)
RETURNS TABLE(
  category text,
  amount_total numeric,
  txn_count bigint,
  paid_amount numeric,
  unpaid_amount numeric,
  pct_of_total numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(desc_store_category_financial), ''), '(sem categoria)') AS category,
      -amount AS expense_amount,
      paid
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
      AND amount < 0
  ),
  agg AS (
    SELECT category,
      COALESCE(SUM(expense_amount), 0)::numeric AS amount_total,
      COUNT(*)::bigint AS txn_count,
      COALESCE(SUM(CASE WHEN paid THEN expense_amount ELSE 0 END), 0)::numeric AS paid_amount,
      COALESCE(SUM(CASE WHEN NOT paid OR paid IS NULL THEN expense_amount ELSE 0 END), 0)::numeric AS unpaid_amount
    FROM base GROUP BY category
  ),
  total AS (SELECT COALESCE(SUM(amount_total), 0) AS t FROM agg)
  SELECT a.category, a.amount_total, a.txn_count, a.paid_amount, a.unpaid_amount,
    CASE WHEN t.t > 0 THEN (a.amount_total * 100.0 / t.t)::numeric(6,2) ELSE 0 END AS pct_of_total
  FROM agg a CROSS JOIN total t
  ORDER BY a.amount_total DESC;
$$;

-- ---------- get_dre_monthly_evolution ----------
CREATE OR REPLACE FUNCTION public.get_dre_monthly_evolution(p_start date, p_end date)
RETURNS TABLE(month_bucket date, revenue numeric, expenses numeric, result numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH rev AS (
    SELECT date_trunc('month', shift_date)::date AS m,
      COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0) - COALESCE(table_total_service_charge, 0)), 0)::numeric AS revenue
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    GROUP BY 1
  ),
  exp AS (
    SELECT date_trunc('month', COALESCE(payment_date, date))::date AS m,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS expenses,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS extra_income
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
    GROUP BY 1
  ),
  months AS (
    SELECT m FROM rev UNION SELECT m FROM exp
  )
  SELECT m.m AS month_bucket,
    (COALESCE(rev.revenue, 0) + COALESCE(exp.extra_income, 0))::numeric AS revenue,
    COALESCE(exp.expenses, 0)::numeric AS expenses,
    (COALESCE(rev.revenue, 0) + COALESCE(exp.extra_income, 0) - COALESCE(exp.expenses, 0))::numeric AS result
  FROM months m
  LEFT JOIN rev ON rev.m = m.m
  LEFT JOIN exp ON exp.m = m.m
  ORDER BY m.m;
$$;

-- ---------- get_dre_data_coverage ----------
CREATE OR REPLACE FUNCTION public.get_dre_data_coverage()
RETURNS TABLE(
  earliest_financial_date date,
  latest_financial_date date,
  total_financial_txns bigint,
  total_negative_txns bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    MIN(COALESCE(payment_date, date))::date AS earliest_financial_date,
    MAX(COALESCE(payment_date, date))::date AS latest_financial_date,
    COUNT(*)::bigint AS total_financial_txns,
    COUNT(*) FILTER (WHERE amount < 0)::bigint AS total_negative_txns
  FROM saipos_financial;
$$;
