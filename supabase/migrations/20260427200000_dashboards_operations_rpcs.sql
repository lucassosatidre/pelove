-- =====================================================
-- Dashboards: Operations aggregation RPCs
-- =====================================================
-- All RPCs operate on saipos_status_history joined with saipos_sales.
-- =====================================================

-- -----------------------------------------------------
-- get_status_avg_times: average time spent in each status
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_status_avg_times(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  status_label text,
  avg_seconds numeric,
  median_seconds numeric,
  p90_seconds numeric,
  total_events bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.desc_store_sale_status AS status_label,
    AVG(h.duration_time_seconds)::numeric AS avg_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.duration_time_seconds)::numeric AS median_seconds,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY h.duration_time_seconds)::numeric AS p90_seconds,
    COUNT(*)::bigint AS total_events
  FROM saipos_status_history h
  JOIN saipos_sales s ON s.id_sale = h.id_sale
  WHERE s.shift_date >= p_start
    AND s.shift_date <= p_end
    AND s.canceled = false
    AND h.duration_time_seconds IS NOT NULL
    AND h.duration_time_seconds > 0
    AND h.desc_store_sale_status IS NOT NULL
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR s.id_sale_type = ANY(p_sale_types))
  GROUP BY h.desc_store_sale_status
  ORDER BY avg_seconds DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_status_avg_times(date, date, int[]) TO authenticated;

-- -----------------------------------------------------
-- get_order_total_time: total time from order creation to last status
-- per sale, returns top-N slowest orders
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_slowest_orders(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id_sale bigint,
  shift_date date,
  id_sale_type smallint,
  type_label text,
  created_at timestamptz,
  partner_desc text,
  total_amount numeric,
  total_seconds bigint,
  worst_status text,
  worst_status_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_sale AS (
    SELECT
      s.id_sale,
      s.shift_date,
      s.id_sale_type,
      s.created_at,
      s.partner_desc,
      s.total_amount,
      SUM(h.duration_time_seconds)::bigint AS total_seconds
    FROM saipos_sales s
    JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND h.duration_time_seconds IS NOT NULL
      AND h.duration_time_seconds > 0
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR s.id_sale_type = ANY(p_sale_types))
    GROUP BY s.id_sale, s.shift_date, s.id_sale_type, s.created_at, s.partner_desc, s.total_amount
  ),
  worst_status_per_sale AS (
    SELECT DISTINCT ON (h.id_sale)
      h.id_sale,
      h.desc_store_sale_status AS worst_status,
      h.duration_time_seconds AS worst_status_seconds
    FROM saipos_status_history h
    JOIN per_sale ps ON ps.id_sale = h.id_sale
    WHERE h.duration_time_seconds IS NOT NULL
    ORDER BY h.id_sale, h.duration_time_seconds DESC NULLS LAST
  )
  SELECT
    ps.id_sale,
    ps.shift_date,
    ps.id_sale_type,
    CASE ps.id_sale_type
      WHEN 1 THEN 'Entrega'
      WHEN 2 THEN 'Balcão'
      WHEN 3 THEN 'Salão'
      WHEN 4 THEN 'Ficha'
      ELSE 'Outro'
    END AS type_label,
    ps.created_at,
    ps.partner_desc,
    ps.total_amount,
    ps.total_seconds,
    w.worst_status,
    w.worst_status_seconds
  FROM per_sale ps
  LEFT JOIN worst_status_per_sale w ON w.id_sale = ps.id_sale
  ORDER BY ps.total_seconds DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_slowest_orders(date, date, int[], int) TO authenticated;

-- -----------------------------------------------------
-- get_cancellations: cancellation breakdown by period & reason
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cancellations(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL
)
RETURNS TABLE (
  total_cancellations bigint,
  total_cancellation_value numeric,
  cancellation_rate_pct numeric,
  by_reason jsonb,
  by_day jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH all_sales AS (
    SELECT id_sale, total_amount, canceled, shift_date
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  ),
  cancellation_reasons AS (
    SELECT DISTINCT ON (h.id_sale)
      h.id_sale,
      COALESCE(NULLIF(TRIM(h.desc_cancellation_reason), ''), '(sem motivo)') AS reason
    FROM saipos_status_history h
    JOIN all_sales s ON s.id_sale = h.id_sale
    WHERE s.canceled = true
      AND h.desc_cancellation_reason IS NOT NULL
    ORDER BY h.id_sale, h.history_created_at DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE a.canceled)::bigint AS total_cancellations,
    SUM(a.total_amount) FILTER (WHERE a.canceled)::numeric AS total_cancellation_value,
    CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE a.canceled) * 100.0 / COUNT(*))::numeric(6, 2)
      ELSE 0 END AS cancellation_rate_pct,
    (
      SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT cr.reason, COUNT(*)::int AS cnt
        FROM cancellation_reasons cr
        GROUP BY cr.reason
        ORDER BY cnt DESC
        LIMIT 20
      ) t
    ) AS by_reason,
    (
      SELECT jsonb_agg(jsonb_build_object('date', d, 'count', cnt, 'value', val) ORDER BY d)
      FROM (
        SELECT a2.shift_date AS d, COUNT(*)::int AS cnt, SUM(a2.total_amount)::numeric AS val
        FROM all_sales a2
        WHERE a2.canceled = true
        GROUP BY a2.shift_date
        ORDER BY a2.shift_date
      ) t
    ) AS by_day
  FROM all_sales a;
$$;

GRANT EXECUTE ON FUNCTION public.get_cancellations(date, date, int[]) TO authenticated;
