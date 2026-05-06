-- =====================================================
-- DRE — Demonstrativo de Resultado do Exercício
-- =====================================================
-- Combina:
--   * Receitas de venda (saipos_sales) — total_amount, descontos, acréscimos,
--     repasses (taxa de entrega + taxa de serviço/garçom).
--   * Movimentações financeiras (saipos_financial) — agrupadas por categoria.
--     Convenção: amount > 0 = entrada, amount < 0 = saída. Quando o saipos
--     manda apenas valor absoluto, considera-se despesa (o caso comum no
--     módulo de contas).
--
-- Todas as funções usam shift_date (vendas) e date (financeiro) como
-- coluna de período. Vendas canceladas são ignoradas.
-- =====================================================

-- -----------------------------------------------------
-- get_dre_summary: KPIs globais do período
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_summary(
  p_start date,
  p_end date
)
RETURNS TABLE (
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales_agg AS (
    SELECT
      COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue,
      COALESCE(SUM(total_discount), 0)::numeric AS total_discount,
      COALESCE(SUM(total_increase), 0)::numeric AS total_increase,
      COALESCE(SUM(delivery_fee), 0)::numeric AS delivery_fee_passthrough,
      COALESCE(SUM(table_total_service_charge), 0)::numeric AS service_charge_passthrough,
      COUNT(*)::bigint AS total_orders
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
  ),
  fin_agg AS (
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS other_income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS total_expenses
    FROM saipos_financial
    WHERE date::date >= p_start
      AND date::date <= p_end
  )
  SELECT
    s.gross_revenue,
    s.total_discount,
    s.total_increase,
    s.delivery_fee_passthrough,
    s.service_charge_passthrough,
    (s.gross_revenue - s.delivery_fee_passthrough - s.service_charge_passthrough)::numeric AS net_sales_revenue,
    s.total_orders,
    CASE WHEN s.total_orders > 0
      THEN (s.gross_revenue / s.total_orders)::numeric
      ELSE 0::numeric
    END AS avg_ticket,
    f.other_income,
    f.total_expenses,
    ((s.gross_revenue - s.delivery_fee_passthrough - s.service_charge_passthrough)
      + f.other_income - f.total_expenses)::numeric AS net_result
  FROM sales_agg s, fin_agg f;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_summary(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_revenue_by_channel: faturamento por canal/tipo de venda
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_revenue_by_channel(
  p_start date,
  p_end date
)
RETURNS TABLE (
  channel text,
  revenue numeric,
  orders bigint,
  pct_of_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      CASE
        WHEN partner_desc IS NOT NULL AND partner_desc <> '' THEN partner_desc
        WHEN id_sale_type = 1 THEN 'Entrega (Próprio)'
        WHEN id_sale_type = 2 THEN 'Balcão'
        WHEN id_sale_type = 3 THEN 'Salão'
        WHEN id_sale_type = 4 THEN 'Ficha'
        ELSE 'Outro'
      END AS channel,
      total_amount
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
  ),
  totals AS (
    SELECT NULLIF(SUM(total_amount), 0) AS grand_total FROM base
  )
  SELECT
    b.channel,
    COALESCE(SUM(b.total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders,
    CASE WHEN t.grand_total IS NULL THEN 0::numeric
      ELSE (SUM(b.total_amount) / t.grand_total * 100)::numeric
    END AS pct_of_total
  FROM base b, totals t
  GROUP BY b.channel, t.grand_total
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_revenue_by_channel(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_expenses_by_category: despesas agrupadas
-- -----------------------------------------------------
-- Convenção: amount < 0 = despesa. Se TODAS as transações vierem positivas
-- (Saipos retornando valor absoluto), nenhuma linha aparece em despesas e
-- todas viram "outras receitas". Ajustar caso o sync seja reescrito.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_expenses_by_category(
  p_start date,
  p_end date
)
RETURNS TABLE (
  category text,
  amount_total numeric,
  txn_count bigint,
  paid_amount numeric,
  unpaid_amount numeric,
  pct_of_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(desc_store_category_financial, ''), '(sem categoria)') AS category,
      -amount AS expense_amount,  -- amount é negativo para despesa, invertemos pra positivo
      paid
    FROM saipos_financial
    WHERE date::date >= p_start
      AND date::date <= p_end
      AND amount < 0
  ),
  totals AS (
    SELECT NULLIF(SUM(expense_amount), 0) AS grand_total FROM base
  )
  SELECT
    b.category,
    COALESCE(SUM(b.expense_amount), 0)::numeric AS amount_total,
    COUNT(*)::bigint AS txn_count,
    COALESCE(SUM(CASE WHEN b.paid IS TRUE THEN b.expense_amount ELSE 0 END), 0)::numeric AS paid_amount,
    COALESCE(SUM(CASE WHEN b.paid IS NOT TRUE THEN b.expense_amount ELSE 0 END), 0)::numeric AS unpaid_amount,
    CASE WHEN t.grand_total IS NULL THEN 0::numeric
      ELSE (SUM(b.expense_amount) / t.grand_total * 100)::numeric
    END AS pct_of_total
  FROM base b, totals t
  GROUP BY b.category, t.grand_total
  ORDER BY amount_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_expenses_by_category(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_monthly_evolution: série mensal (receita × despesa × resultado)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_monthly_evolution(
  p_start date,
  p_end date
)
RETURNS TABLE (
  month_bucket date,
  revenue numeric,
  expenses numeric,
  result numeric
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
      COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0) - COALESCE(table_total_service_charge, 0)), 0)::numeric AS revenue
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
    GROUP BY 1
  ),
  exp AS (
    SELECT
      date_trunc('month', date)::date AS month_bucket,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS expenses
    FROM saipos_financial
    WHERE date::date >= p_start
      AND date::date <= p_end
    GROUP BY 1
  )
  SELECT
    m.month_bucket,
    COALESCE(rev.revenue, 0)::numeric AS revenue,
    COALESCE(exp.expenses, 0)::numeric AS expenses,
    (COALESCE(rev.revenue, 0) - COALESCE(exp.expenses, 0))::numeric AS result
  FROM months m
  LEFT JOIN rev ON rev.month_bucket = m.month_bucket
  LEFT JOIN exp ON exp.month_bucket = m.month_bucket
  ORDER BY m.month_bucket;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_monthly_evolution(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_data_coverage: existe dado financeiro no período?
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_data_coverage()
RETURNS TABLE (
  earliest_financial_date date,
  latest_financial_date date,
  total_financial_txns bigint,
  total_negative_txns bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    MIN(date)::date AS earliest_financial_date,
    MAX(date)::date AS latest_financial_date,
    COUNT(*)::bigint AS total_financial_txns,
    COUNT(*) FILTER (WHERE amount < 0)::bigint AS total_negative_txns
  FROM saipos_financial;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_data_coverage() TO authenticated;
