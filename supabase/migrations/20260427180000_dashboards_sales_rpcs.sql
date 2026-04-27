-- =====================================================
-- Dashboards: Sales aggregation RPCs
-- =====================================================
-- All functions:
--   * Use shift_date as the date column (Saipos-recommended)
--   * Filter out canceled sales
--   * Accept optional p_sale_types int[] (1=Entrega, 2=Balcão, 3=Salão, 4=Ficha)
--     null/empty array = all types
--
-- Granularity: 'day' | 'week' | 'month' | 'year' (truncates shift_date)
-- =====================================================

-- -----------------------------------------------------
-- Helper: bucket shift_date by granularity
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.date_bucket(
  p_date date,
  p_granularity text
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(p_granularity)
    WHEN 'day'   THEN p_date
    WHEN 'week'  THEN date_trunc('week',  p_date)::date
    WHEN 'month' THEN date_trunc('month', p_date)::date
    WHEN 'year'  THEN date_trunc('year',  p_date)::date
    ELSE p_date
  END;
$$;

-- -----------------------------------------------------
-- get_sales_totals: single bucket (no grouping by date)
-- Returns total revenue + count for the whole period.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_totals(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  total_revenue numeric,
  total_orders bigint,
  avg_ticket numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
    COUNT(*)::bigint AS total_orders,
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_amount), 0) / COUNT(*) ELSE 0 END AS avg_ticket
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types));
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_totals(date, date, int[]) TO authenticated;

-- -----------------------------------------------------
-- get_sales_series: time series at given granularity
-- One row per bucket in the period.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_series(
  p_start date,
  p_end date,
  p_granularity text DEFAULT 'day',
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  bucket date,
  revenue numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.date_bucket(shift_date, p_granularity) AS bucket,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_series(date, date, text, int[]) TO authenticated;

-- -----------------------------------------------------
-- get_sales_by_type: breakdown by id_sale_type
-- Useful for the filter UI to show counts per option.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_by_type(
  p_start date,
  p_end date
)
RETURNS TABLE (
  id_sale_type smallint,
  type_label text,
  revenue numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id_sale_type,
    CASE id_sale_type
      WHEN 1 THEN 'Entrega'
      WHEN 2 THEN 'Balcão'
      WHEN 3 THEN 'Salão'
      WHEN 4 THEN 'Ficha'
      ELSE 'Outro'
    END AS type_label,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
  GROUP BY id_sale_type
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_by_type(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_sales_by_shift: total per Saipos shift (Dia/Noite/etc.)
-- The shift name comes from the sale itself (store_shift_desc).
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_by_shift(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  shift_label text,
  starting_time text,
  revenue numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(store_shift_desc, '(sem turno)') AS shift_label,
    COALESCE(store_shift_starting_time, '') AS starting_time,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1, 2
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_by_shift(date, date, int[]) TO authenticated;

-- -----------------------------------------------------
-- get_sales_heatmap: revenue by hour-of-day × day-of-week
-- For the "curva de vendas por hora" heatmap.
-- Uses created_at (not shift_date) to get true hour of order.
-- dow: 0=Sunday ... 6=Saturday
-- hour: 0..23
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_heatmap(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  dow smallint,
  hour smallint,
  revenue numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM created_at)::smallint AS dow,
    EXTRACT(HOUR FROM created_at)::smallint AS hour,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start
    AND shift_date <= p_end
    AND canceled = false
    AND created_at IS NOT NULL
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_heatmap(date, date, int[]) TO authenticated;

-- -----------------------------------------------------
-- get_data_coverage: earliest and latest shift_date in the mirror
-- Used by the UI to know when data starts (so we don't suggest
-- ridiculous comparison periods).
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_data_coverage()
RETURNS TABLE (
  earliest_date date,
  latest_date date,
  total_sales bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    MIN(shift_date) AS earliest_date,
    MAX(shift_date) AS latest_date,
    COUNT(*)::bigint AS total_sales
  FROM saipos_sales
  WHERE canceled = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_data_coverage() TO authenticated;
