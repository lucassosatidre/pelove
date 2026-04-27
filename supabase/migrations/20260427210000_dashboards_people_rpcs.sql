-- =====================================================
-- Dashboards: People aggregation RPCs
-- =====================================================

-- -----------------------------------------------------
-- get_waiter_ranking: revenue + items by waiter
-- Uses id_store_waiter from saipos_sales_items.
-- We can't get the waiter name from the items table — we'd need
-- a /users endpoint (not available in Saipos API). For now we
-- show id_store_waiter and let the user mentally map.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waiter_ranking(
  p_start date,
  p_end date,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id_store_waiter bigint,
  total_revenue numeric,
  total_items bigint,
  total_orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id_store_waiter,
    SUM(i.quantity * i.unit_price)::numeric AS total_revenue,
    SUM(i.quantity)::bigint AS total_items,
    COUNT(DISTINCT i.id_sale)::bigint AS total_orders
  FROM saipos_sales_items i
  JOIN saipos_sales s ON s.id_sale = i.id_sale
  WHERE s.shift_date >= p_start
    AND s.shift_date <= p_end
    AND s.canceled = false
    AND i.deleted = false
    AND i.id_store_waiter IS NOT NULL
    AND i.id_store_waiter > 0
    AND s.id_sale_type = 3 -- only Salão
  GROUP BY i.id_store_waiter
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_waiter_ranking(date, date, int) TO authenticated;

-- -----------------------------------------------------
-- get_table_metrics: tempo médio de mesa, ticket médio mesa, total clientes
-- For Salão sales: time = last status created_at - first status created_at
-- (or sale.created_at to last status if no first)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_metrics(
  p_start date,
  p_end date
)
RETURNS TABLE (
  total_table_orders bigint,
  total_customers bigint,
  avg_customers_per_table numeric,
  avg_table_revenue numeric,
  avg_minutes_open numeric,
  total_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH durations AS (
    SELECT
      s.id_sale,
      s.total_amount,
      s.table_customers_count,
      EXTRACT(EPOCH FROM (MAX(h.history_created_at) - MIN(COALESCE(h.history_created_at, s.created_at)))) / 60.0 AS minutes
    FROM saipos_sales s
    LEFT JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND s.id_sale_type = 3
    GROUP BY s.id_sale, s.total_amount, s.table_customers_count, s.created_at
  )
  SELECT
    COUNT(*)::bigint AS total_table_orders,
    COALESCE(SUM(table_customers_count), 0)::bigint AS total_customers,
    AVG(NULLIF(table_customers_count, 0))::numeric AS avg_customers_per_table,
    AVG(total_amount)::numeric AS avg_table_revenue,
    AVG(NULLIF(minutes, 0))::numeric AS avg_minutes_open,
    SUM(total_amount)::numeric AS total_revenue
  FROM durations;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_metrics(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_service_charge_metrics: taxa de serviço cobrada vs paga
-- Heuristic: assume taxa was "paid" if total_amount >= total_amount_items + service_charge
-- Saipos doesn't expose the actual paid amount of service charge directly,
-- so we use a presence/coverage heuristic.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_service_charge_metrics(
  p_start date,
  p_end date
)
RETURNS TABLE (
  total_orders_with_charge bigint,
  total_charged numeric,
  total_paid_estimated numeric,
  total_refused_estimated numeric,
  refused_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      id_sale,
      COALESCE(table_total_service_charge, 0) AS charged,
      COALESCE(total_amount, 0) AS total,
      COALESCE(total_amount_items, 0) AS items,
      COALESCE(total_discount, 0) AS discount,
      COALESCE(total_increase, 0) AS increase,
      COALESCE(delivery_fee, 0) AS delivery
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
      AND id_sale_type = 3
      AND COALESCE(table_total_service_charge, 0) > 0
  )
  SELECT
    COUNT(*)::bigint AS total_orders_with_charge,
    SUM(charged)::numeric AS total_charged,
    -- Estimated paid: how much of the charge actually appears reflected in total_amount
    SUM(GREATEST(0, LEAST(charged, total - items + discount - increase - delivery)))::numeric AS total_paid_estimated,
    SUM(charged - GREATEST(0, LEAST(charged, total - items + discount - increase - delivery)))::numeric AS total_refused_estimated,
    CASE WHEN SUM(charged) > 0
      THEN (SUM(charged - GREATEST(0, LEAST(charged, total - items + discount - increase - delivery))) * 100.0 / SUM(charged))::numeric(6, 2)
      ELSE 0 END AS refused_pct
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_service_charge_metrics(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_top_customers: top by revenue + recent activity
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_customers(
  p_start date,
  p_end date,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  customer_id_customer bigint,
  customer_name text,
  customer_phone text,
  total_revenue numeric,
  total_orders bigint,
  avg_ticket numeric,
  last_order_date date,
  first_order_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    customer_id_customer,
    MAX(customer_name) AS customer_name,
    MAX(customer_phone) AS customer_phone,
    SUM(total_amount)::numeric AS total_revenue,
    COUNT(*)::bigint AS total_orders,
    (SUM(total_amount) / NULLIF(COUNT(*), 0))::numeric AS avg_ticket,
    MAX(shift_date) AS last_order_date,
    MIN(shift_date) AS first_order_date
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
    AND customer_id_customer IS NOT NULL
    AND customer_id_customer > 0
  GROUP BY customer_id_customer
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_customers(date, date, int) TO authenticated;

-- -----------------------------------------------------
-- get_delivery_time: avg time created → done
-- For delivery sales: we use the sum of all status durations as a proxy.
-- Could be improved later by detecting specific 'Entregue' status.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_delivery_time_metrics(
  p_start date,
  p_end date
)
RETURNS TABLE (
  total_delivery_orders bigint,
  avg_minutes numeric,
  median_minutes numeric,
  p90_minutes numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_sale AS (
    SELECT
      s.id_sale,
      SUM(h.duration_time_seconds) / 60.0 AS minutes
    FROM saipos_sales s
    JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND s.id_sale_type = 1 -- Entrega only
      AND h.duration_time_seconds IS NOT NULL
      AND h.duration_time_seconds > 0
    GROUP BY s.id_sale
    HAVING SUM(h.duration_time_seconds) > 0
  )
  SELECT
    COUNT(*)::bigint AS total_delivery_orders,
    AVG(minutes)::numeric AS avg_minutes,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes)::numeric AS median_minutes,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY minutes)::numeric AS p90_minutes
  FROM per_sale;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_time_metrics(date, date) TO authenticated;
