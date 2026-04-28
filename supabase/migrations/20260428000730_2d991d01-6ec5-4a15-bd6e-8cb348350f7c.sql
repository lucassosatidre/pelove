-- ============================ Dashboards: Sales ============================
CREATE OR REPLACE FUNCTION public.date_bucket(p_date date, p_granularity text)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(p_granularity)
    WHEN 'day'   THEN p_date
    WHEN 'week'  THEN date_trunc('week',  p_date)::date
    WHEN 'month' THEN date_trunc('month', p_date)::date
    WHEN 'year'  THEN date_trunc('year',  p_date)::date
    ELSE p_date END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_totals(p_start date, p_end date, p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (total_revenue numeric, total_orders bigint, avg_ticket numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
    COUNT(*)::bigint AS total_orders,
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_amount), 0) / COUNT(*) ELSE 0 END AS avg_ticket
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types));
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_totals(date, date, int[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sales_series(p_start date, p_end date, p_granularity text DEFAULT 'day', p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (bucket date, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.date_bucket(shift_date, p_granularity) AS bucket,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1 ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_series(date, date, text, int[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sales_by_type(p_start date, p_end date)
RETURNS TABLE (id_sale_type smallint, type_label text, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    id_sale_type,
    CASE id_sale_type WHEN 1 THEN 'Entrega' WHEN 2 THEN 'Balcão' WHEN 3 THEN 'Salão' WHEN 4 THEN 'Ficha' ELSE 'Outro' END AS type_label,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
  GROUP BY id_sale_type ORDER BY revenue DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_by_type(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sales_by_shift(p_start date, p_end date, p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (shift_label text, starting_time text, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(store_shift_desc, '(sem turno)') AS shift_label,
    COALESCE(store_shift_starting_time, '') AS starting_time,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1, 2 ORDER BY revenue DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_by_shift(date, date, int[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sales_heatmap(p_start date, p_end date, p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (dow smallint, hour smallint, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXTRACT(DOW FROM created_at)::smallint AS dow,
    EXTRACT(HOUR FROM created_at)::smallint AS hour,
    COALESCE(SUM(total_amount), 0)::numeric AS revenue,
    COUNT(*)::bigint AS orders
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false AND created_at IS NOT NULL
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  GROUP BY 1, 2 ORDER BY 1, 2;
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_heatmap(date, date, int[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_data_coverage()
RETURNS TABLE (earliest_date date, latest_date date, total_sales bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT MIN(shift_date) AS earliest_date, MAX(shift_date) AS latest_date, COUNT(*)::bigint AS total_sales
  FROM saipos_sales WHERE canceled = false;
$$;
GRANT EXECUTE ON FUNCTION public.get_data_coverage() TO authenticated;

-- ============================ Dashboards: Products ============================
CREATE OR REPLACE FUNCTION public.get_top_products(p_start date, p_end date, p_sale_types int[] DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (normalized_name text, display_name text, quantity numeric, revenue numeric, orders bigint, channels text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH joined AS (
    SELECT i.normalized_name, i.desc_sale_item, i.quantity, i.unit_price, i.id_sale_type, i.id_sale
    FROM saipos_sales_items i JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND i.deleted = false
      AND i.normalized_name IS NOT NULL AND i.normalized_name <> ''
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  ranked AS (
    SELECT normalized_name,
      SUM(quantity)::numeric AS quantity,
      SUM(quantity * unit_price)::numeric AS revenue,
      COUNT(DISTINCT id_sale)::bigint AS orders,
      ARRAY_AGG(DISTINCT CASE id_sale_type WHEN 1 THEN 'Entrega' WHEN 2 THEN 'Balcão' WHEN 3 THEN 'Salão' WHEN 4 THEN 'Ficha' ELSE 'Outro' END) AS channels
    FROM joined GROUP BY normalized_name
  ),
  display AS (
    SELECT DISTINCT ON (normalized_name) normalized_name, desc_sale_item AS display_name
    FROM joined ORDER BY normalized_name, length(desc_sale_item) DESC
  )
  SELECT r.normalized_name, d.display_name, r.quantity, r.revenue, r.orders, r.channels
  FROM ranked r JOIN display d USING (normalized_name)
  ORDER BY r.revenue DESC LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_products(date, date, int[], int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_product_by_hour(p_start date, p_end date, p_sale_types int[] DEFAULT NULL, p_top_products int DEFAULT 10)
RETURNS TABLE (normalized_name text, display_name text, hour smallint, quantity numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT i.normalized_name, i.desc_sale_item, i.quantity, i.unit_price, i.id_sale,
      EXTRACT(HOUR FROM s.created_at)::smallint AS hour
    FROM saipos_sales_items i JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND i.deleted = false
      AND i.normalized_name IS NOT NULL AND i.normalized_name <> '' AND s.created_at IS NOT NULL
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  top_n AS (SELECT normalized_name, SUM(quantity * unit_price) AS rev FROM base GROUP BY normalized_name ORDER BY rev DESC LIMIT p_top_products),
  display AS (
    SELECT DISTINCT ON (b.normalized_name) b.normalized_name, b.desc_sale_item AS display_name
    FROM base b JOIN top_n USING (normalized_name) ORDER BY b.normalized_name, length(b.desc_sale_item) DESC
  )
  SELECT b.normalized_name, d.display_name, b.hour, SUM(b.quantity)::numeric AS quantity, COUNT(DISTINCT b.id_sale)::bigint AS orders
  FROM base b JOIN top_n USING (normalized_name) JOIN display d USING (normalized_name)
  GROUP BY b.normalized_name, d.display_name, b.hour ORDER BY b.normalized_name, b.hour;
$$;
GRANT EXECUTE ON FUNCTION public.get_product_by_hour(date, date, int[], int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_product_by_dow(p_start date, p_end date, p_sale_types int[] DEFAULT NULL, p_top_products int DEFAULT 10)
RETURNS TABLE (normalized_name text, display_name text, dow smallint, quantity numeric, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT i.normalized_name, i.desc_sale_item, i.quantity, i.unit_price, i.id_sale,
      EXTRACT(DOW FROM s.shift_date)::smallint AS dow
    FROM saipos_sales_items i JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND i.deleted = false
      AND i.normalized_name IS NOT NULL AND i.normalized_name <> ''
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  top_n AS (SELECT normalized_name, SUM(quantity * unit_price) AS rev FROM base GROUP BY normalized_name ORDER BY rev DESC LIMIT p_top_products),
  display AS (
    SELECT DISTINCT ON (b.normalized_name) b.normalized_name, b.desc_sale_item AS display_name
    FROM base b JOIN top_n USING (normalized_name) ORDER BY b.normalized_name, length(b.desc_sale_item) DESC
  )
  SELECT b.normalized_name, d.display_name, b.dow, SUM(b.quantity)::numeric AS quantity, COUNT(DISTINCT b.id_sale)::bigint AS orders
  FROM base b JOIN top_n USING (normalized_name) JOIN display d USING (normalized_name)
  GROUP BY b.normalized_name, d.display_name, b.dow ORDER BY b.normalized_name, b.dow;
$$;
GRANT EXECUTE ON FUNCTION public.get_product_by_dow(date, date, int[], int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_top_addons(p_start date, p_end date, p_sale_types int[] DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (addon_name text, uses bigint, total_additional_value numeric, parent_products text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH expanded AS (
    SELECT
      LOWER(TRIM(COALESCE(c->>'desc_sale_item_choice', c->>'desc_store_choice_item', ''))) AS addon_name,
      COALESCE((c->>'aditional_price')::numeric, 0) AS aditional_price,
      i.normalized_name, i.desc_sale_item AS parent_display
    FROM saipos_sales_items i JOIN saipos_sales s ON s.id_sale = i.id_sale,
      LATERAL jsonb_array_elements(COALESCE(i.raw_payload->'choices', '[]'::jsonb)) AS c
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND i.deleted = false
      AND COALESCE(c->>'deleted', 'N') = 'N'
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  )
  SELECT
    addon_name,
    COUNT(*)::bigint AS uses,
    SUM(aditional_price)::numeric AS total_additional_value,
    (
      SELECT ARRAY_AGG(DISTINCT parent_display ORDER BY parent_display)
      FROM (
        SELECT parent_display FROM expanded e2
        WHERE e2.addon_name = e1.addon_name AND e2.parent_display IS NOT NULL
        LIMIT 5
      ) t
    ) AS parent_products
  FROM expanded e1 WHERE addon_name <> ''
  GROUP BY addon_name ORDER BY uses DESC LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_addons(date, date, int[], int) TO authenticated;

-- ============================ Dashboards: Operations ============================
CREATE OR REPLACE FUNCTION public.get_status_avg_times(p_start date, p_end date, p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (status_label text, avg_seconds numeric, median_seconds numeric, p90_seconds numeric, total_events bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    h.desc_store_sale_status AS status_label,
    AVG(h.duration_time_seconds)::numeric AS avg_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.duration_time_seconds)::numeric AS median_seconds,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY h.duration_time_seconds)::numeric AS p90_seconds,
    COUNT(*)::bigint AS total_events
  FROM saipos_status_history h JOIN saipos_sales s ON s.id_sale = h.id_sale
  WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false
    AND h.duration_time_seconds IS NOT NULL AND h.duration_time_seconds > 0
    AND h.desc_store_sale_status IS NOT NULL
    AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR s.id_sale_type = ANY(p_sale_types))
  GROUP BY h.desc_store_sale_status ORDER BY avg_seconds DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_status_avg_times(date, date, int[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_slowest_orders(p_start date, p_end date, p_sale_types int[] DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (id_sale bigint, shift_date date, id_sale_type smallint, type_label text, created_at timestamptz, partner_desc text, total_amount numeric, total_seconds bigint, worst_status text, worst_status_seconds integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH per_sale AS (
    SELECT s.id_sale, s.shift_date, s.id_sale_type, s.created_at, s.partner_desc, s.total_amount,
      SUM(h.duration_time_seconds)::bigint AS total_seconds
    FROM saipos_sales s JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false
      AND h.duration_time_seconds IS NOT NULL AND h.duration_time_seconds > 0
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR s.id_sale_type = ANY(p_sale_types))
    GROUP BY s.id_sale, s.shift_date, s.id_sale_type, s.created_at, s.partner_desc, s.total_amount
  ),
  worst_status_per_sale AS (
    SELECT DISTINCT ON (h.id_sale) h.id_sale, h.desc_store_sale_status AS worst_status, h.duration_time_seconds AS worst_status_seconds
    FROM saipos_status_history h JOIN per_sale ps ON ps.id_sale = h.id_sale
    WHERE h.duration_time_seconds IS NOT NULL
    ORDER BY h.id_sale, h.duration_time_seconds DESC NULLS LAST
  )
  SELECT ps.id_sale, ps.shift_date, ps.id_sale_type,
    CASE ps.id_sale_type WHEN 1 THEN 'Entrega' WHEN 2 THEN 'Balcão' WHEN 3 THEN 'Salão' WHEN 4 THEN 'Ficha' ELSE 'Outro' END AS type_label,
    ps.created_at, ps.partner_desc, ps.total_amount, ps.total_seconds, w.worst_status, w.worst_status_seconds
  FROM per_sale ps LEFT JOIN worst_status_per_sale w ON w.id_sale = ps.id_sale
  ORDER BY ps.total_seconds DESC LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_slowest_orders(date, date, int[], int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cancellations(p_start date, p_end date, p_sale_types int[] DEFAULT NULL)
RETURNS TABLE (total_cancellations bigint, total_cancellation_value numeric, cancellation_rate_pct numeric, by_reason jsonb, by_day jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH all_sales AS (
    SELECT id_sale, total_amount, canceled, shift_date FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR id_sale_type = ANY(p_sale_types))
  ),
  cancellation_reasons AS (
    SELECT DISTINCT ON (h.id_sale) h.id_sale,
      COALESCE(NULLIF(TRIM(h.desc_cancellation_reason), ''), '(sem motivo)') AS reason
    FROM saipos_status_history h JOIN all_sales s ON s.id_sale = h.id_sale
    WHERE s.canceled = true AND h.desc_cancellation_reason IS NOT NULL
    ORDER BY h.id_sale, h.history_created_at DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE a.canceled)::bigint AS total_cancellations,
    SUM(a.total_amount) FILTER (WHERE a.canceled)::numeric AS total_cancellation_value,
    CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE a.canceled) * 100.0 / COUNT(*))::numeric(6, 2) ELSE 0 END AS cancellation_rate_pct,
    (SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
     FROM (SELECT cr.reason, COUNT(*)::int AS cnt FROM cancellation_reasons cr GROUP BY cr.reason ORDER BY cnt DESC LIMIT 20) t) AS by_reason,
    (SELECT jsonb_agg(jsonb_build_object('date', d, 'count', cnt, 'value', val) ORDER BY d)
     FROM (SELECT a2.shift_date AS d, COUNT(*)::int AS cnt, SUM(a2.total_amount)::numeric AS val
           FROM all_sales a2 WHERE a2.canceled = true GROUP BY a2.shift_date ORDER BY a2.shift_date) t) AS by_day
  FROM all_sales a;
$$;
GRANT EXECUTE ON FUNCTION public.get_cancellations(date, date, int[]) TO authenticated;

-- ============================ Dashboards: People ============================
CREATE OR REPLACE FUNCTION public.get_waiter_ranking(p_start date, p_end date, p_limit int DEFAULT 30)
RETURNS TABLE (id_store_waiter bigint, total_revenue numeric, total_items bigint, total_orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id_store_waiter,
    SUM(i.quantity * i.unit_price)::numeric AS total_revenue,
    SUM(i.quantity)::bigint AS total_items,
    COUNT(DISTINCT i.id_sale)::bigint AS total_orders
  FROM saipos_sales_items i JOIN saipos_sales s ON s.id_sale = i.id_sale
  WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND i.deleted = false
    AND i.id_store_waiter IS NOT NULL AND i.id_store_waiter > 0 AND s.id_sale_type = 3
  GROUP BY i.id_store_waiter ORDER BY total_revenue DESC LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_waiter_ranking(date, date, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_table_metrics(p_start date, p_end date)
RETURNS TABLE (total_table_orders bigint, total_customers bigint, avg_customers_per_table numeric, avg_table_revenue numeric, avg_minutes_open numeric, total_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH durations AS (
    SELECT s.id_sale, s.total_amount, s.table_customers_count,
      EXTRACT(EPOCH FROM (MAX(h.history_created_at) - MIN(COALESCE(h.history_created_at, s.created_at)))) / 60.0 AS minutes
    FROM saipos_sales s LEFT JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND s.id_sale_type = 3
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

CREATE OR REPLACE FUNCTION public.get_service_charge_metrics(p_start date, p_end date)
RETURNS TABLE (total_orders_with_charge bigint, total_charged numeric, total_paid_estimated numeric, total_refused_estimated numeric, refused_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT id_sale,
      COALESCE(table_total_service_charge, 0) AS charged,
      COALESCE(total_amount, 0) AS total,
      COALESCE(total_amount_items, 0) AS items,
      COALESCE(total_discount, 0) AS discount,
      COALESCE(total_increase, 0) AS increase,
      COALESCE(delivery_fee, 0) AS delivery
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false AND id_sale_type = 3
      AND COALESCE(table_total_service_charge, 0) > 0
  )
  SELECT
    COUNT(*)::bigint AS total_orders_with_charge,
    SUM(charged)::numeric AS total_charged,
    SUM(GREATEST(0, LEAST(charged, total - items + discount - increase - delivery)))::numeric AS total_paid_estimated,
    SUM(charged - GREATEST(0, LEAST(charged, total - items + discount - increase - delivery)))::numeric AS total_refused_estimated,
    CASE WHEN SUM(charged) > 0
      THEN (SUM(charged - GREATEST(0, LEAST(charged, total - items + discount - increase - delivery))) * 100.0 / SUM(charged))::numeric(6, 2)
      ELSE 0 END AS refused_pct
  FROM base;
$$;
GRANT EXECUTE ON FUNCTION public.get_service_charge_metrics(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_top_customers(p_start date, p_end date, p_limit int DEFAULT 30)
RETURNS TABLE (customer_id_customer bigint, customer_name text, customer_phone text, total_revenue numeric, total_orders bigint, avg_ticket numeric, last_order_date date, first_order_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT customer_id_customer,
    MAX(customer_name) AS customer_name,
    MAX(customer_phone) AS customer_phone,
    SUM(total_amount)::numeric AS total_revenue,
    COUNT(*)::bigint AS total_orders,
    (SUM(total_amount) / NULLIF(COUNT(*), 0))::numeric AS avg_ticket,
    MAX(shift_date) AS last_order_date,
    MIN(shift_date) AS first_order_date
  FROM saipos_sales
  WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    AND customer_id_customer IS NOT NULL AND customer_id_customer > 0
  GROUP BY customer_id_customer ORDER BY total_revenue DESC LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_customers(date, date, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_delivery_time_metrics(p_start date, p_end date)
RETURNS TABLE (total_delivery_orders bigint, avg_minutes numeric, median_minutes numeric, p90_minutes numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH per_sale AS (
    SELECT s.id_sale, SUM(h.duration_time_seconds) / 60.0 AS minutes
    FROM saipos_sales s JOIN saipos_status_history h ON h.id_sale = s.id_sale
    WHERE s.shift_date >= p_start AND s.shift_date <= p_end AND s.canceled = false AND s.id_sale_type = 1
      AND h.duration_time_seconds IS NOT NULL AND h.duration_time_seconds > 0
    GROUP BY s.id_sale HAVING SUM(h.duration_time_seconds) > 0
  )
  SELECT COUNT(*)::bigint AS total_delivery_orders,
    AVG(minutes)::numeric AS avg_minutes,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes)::numeric AS median_minutes,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY minutes)::numeric AS p90_minutes
  FROM per_sale;
$$;
GRANT EXECUTE ON FUNCTION public.get_delivery_time_metrics(date, date) TO authenticated;

-- ============================ Advisor tables ============================
CREATE TABLE public.advisor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_user ON public.advisor_conversations(user_id, last_message_at DESC) WHERE archived = false;
ALTER TABLE public.advisor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own conversations" ON public.advisor_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own conversations" ON public.advisor_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own conversations" ON public.advisor_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own conversations" ON public.advisor_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.advisor_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content jsonb NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_input_tokens integer,
  cache_creation_input_tokens integer,
  tool_calls jsonb,
  tool_results jsonb,
  stop_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conv ON public.advisor_messages(conversation_id, created_at);
ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see messages of their conversations" ON public.advisor_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.advisor_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users insert messages on their conversations" ON public.advisor_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.advisor_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

CREATE TABLE public.advisor_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT 'geral',
  fact text NOT NULL,
  source_conversation_id uuid REFERENCES public.advisor_conversations(id) ON DELETE SET NULL,
  confidence numeric(3, 2) DEFAULT 1.0,
  user_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_facts_user ON public.advisor_facts(user_id, topic);
ALTER TABLE public.advisor_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own facts" ON public.advisor_facts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own facts" ON public.advisor_facts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own facts" ON public.advisor_facts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own facts" ON public.advisor_facts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.advisor_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date date NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  domain text NOT NULL DEFAULT 'vendas',
  title text NOT NULL,
  body text NOT NULL,
  metadata jsonb,
  dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  generated_by text NOT NULL DEFAULT 'cron',
  generation_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_date ON public.advisor_insights(for_date DESC, dismissed);
ALTER TABLE public.advisor_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users see insights" ON public.advisor_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users dismiss insights" ON public.advisor_insights FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER trg_advisor_facts_updated_at BEFORE UPDATE ON public.advisor_facts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================ Advisor cron setup ============================
CREATE OR REPLACE FUNCTION public.schedule_saipos_crons(p_functions_url text, p_auth_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, cron AS $$
DECLARE
  v_url text := rtrim(p_functions_url, '/');
  v_jobs jsonb := '[]'::jsonb;
  v_job_id bigint;
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN ('saipos_cron_incremental', 'saipos_cron_daily', 'saipos_cron_old_data_check', 'advisor_daily_insights');

  v_job_id := cron.schedule('saipos_cron_incremental', '*/30 * * * *',
    format($sql$ SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 60000); $sql$,
      v_url || '/saipos-cron?mode=incremental',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key), '{}'::jsonb));
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_incremental', 'id', v_job_id, 'schedule', '*/30 * * * *');

  v_job_id := cron.schedule('saipos_cron_daily', '0 4 * * *',
    format($sql$ SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 120000); $sql$,
      v_url || '/saipos-cron?mode=daily',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key), '{}'::jsonb));
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_daily', 'id', v_job_id, 'schedule', '0 4 * * *');

  v_job_id := cron.schedule('saipos_cron_old_data_check', '0 5 * * 0',
    format($sql$ SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 300000); $sql$,
      v_url || '/saipos-cron?mode=old_data_check',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key), '{}'::jsonb));
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_old_data_check', 'id', v_job_id, 'schedule', '0 5 * * 0');

  v_job_id := cron.schedule('advisor_daily_insights', '30 5 * * *',
    format($sql$ SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 120000); $sql$,
      v_url || '/advisor-generate-insights',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key), '{}'::jsonb));
  v_jobs := v_jobs || jsonb_build_object('name', 'advisor_daily_insights', 'id', v_job_id, 'schedule', '30 5 * * *');

  RETURN jsonb_build_object('success', true, 'jobs', v_jobs);
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_saipos_crons()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, cron AS $$
DECLARE
  v_removed text[] := ARRAY[]::text[];
  v_jobname text;
BEGIN
  FOR v_jobname IN SELECT jobname FROM cron.job
    WHERE jobname IN ('saipos_cron_incremental', 'saipos_cron_daily', 'saipos_cron_old_data_check', 'advisor_daily_insights')
  LOOP
    PERFORM cron.unschedule(v_jobname);
    v_removed := array_append(v_removed, v_jobname);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'removed', v_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_saipos_crons()
RETURNS TABLE (jobname text, schedule text, active boolean, jobid bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, cron AS $$
  SELECT j.jobname, j.schedule, j.active, j.jobid FROM cron.job j
  WHERE j.jobname LIKE 'saipos_cron_%' OR j.jobname = 'advisor_daily_insights'
  ORDER BY j.jobname;
$$;