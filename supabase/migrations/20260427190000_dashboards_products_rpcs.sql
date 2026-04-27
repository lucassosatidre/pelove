-- =====================================================
-- Dashboards: Products aggregation RPCs
-- =====================================================
-- Aggregations over saipos_sales_items joined with saipos_sales
-- (we need shift_date and id_sale_type from sales).
--
-- Dedup strategy: group by normalized_name (already calculated
-- by the sync function). Sales like "Pizza Calabresa Salão" and
-- "Pizza Calabresa Delivery" become a single bucket "pizza calabresa".
-- A representative desc_sale_item is also returned for display.
-- =====================================================

-- -----------------------------------------------------
-- get_top_products: ranking with dedup across channels
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  normalized_name text,
  display_name text,
  quantity numeric,
  revenue numeric,
  orders bigint,
  channels text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH joined AS (
    SELECT
      i.normalized_name,
      i.desc_sale_item,
      i.quantity,
      i.unit_price,
      i.id_sale_type,
      i.id_sale
    FROM saipos_sales_items i
    JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND i.deleted = false
      AND i.normalized_name IS NOT NULL
      AND i.normalized_name <> ''
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  ranked AS (
    SELECT
      normalized_name,
      SUM(quantity)::numeric AS quantity,
      SUM(quantity * unit_price)::numeric AS revenue,
      COUNT(DISTINCT id_sale)::bigint AS orders,
      ARRAY_AGG(DISTINCT
        CASE id_sale_type
          WHEN 1 THEN 'Entrega'
          WHEN 2 THEN 'Balcão'
          WHEN 3 THEN 'Salão'
          WHEN 4 THEN 'Ficha'
          ELSE 'Outro'
        END
      ) AS channels
    FROM joined
    GROUP BY normalized_name
  ),
  display AS (
    SELECT DISTINCT ON (normalized_name)
      normalized_name,
      desc_sale_item AS display_name
    FROM joined
    ORDER BY normalized_name, length(desc_sale_item) DESC
  )
  SELECT
    r.normalized_name,
    d.display_name,
    r.quantity,
    r.revenue,
    r.orders,
    r.channels
  FROM ranked r
  JOIN display d USING (normalized_name)
  ORDER BY r.revenue DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(date, date, int[], int) TO authenticated;

-- -----------------------------------------------------
-- get_product_by_hour: when each product sells most (hour of day)
-- Returns top-N products with their hourly distribution.
-- Uses created_at from sales to get true order time.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_by_hour(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL,
  p_top_products int DEFAULT 10
)
RETURNS TABLE (
  normalized_name text,
  display_name text,
  hour smallint,
  quantity numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      i.normalized_name,
      i.desc_sale_item,
      i.quantity,
      i.unit_price,
      i.id_sale,
      EXTRACT(HOUR FROM s.created_at)::smallint AS hour
    FROM saipos_sales_items i
    JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND i.deleted = false
      AND i.normalized_name IS NOT NULL
      AND i.normalized_name <> ''
      AND s.created_at IS NOT NULL
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  top_n AS (
    SELECT normalized_name, SUM(quantity * unit_price) AS rev
    FROM base
    GROUP BY normalized_name
    ORDER BY rev DESC
    LIMIT p_top_products
  ),
  display AS (
    SELECT DISTINCT ON (b.normalized_name)
      b.normalized_name, b.desc_sale_item AS display_name
    FROM base b
    JOIN top_n USING (normalized_name)
    ORDER BY b.normalized_name, length(b.desc_sale_item) DESC
  )
  SELECT
    b.normalized_name,
    d.display_name,
    b.hour,
    SUM(b.quantity)::numeric AS quantity,
    COUNT(DISTINCT b.id_sale)::bigint AS orders
  FROM base b
  JOIN top_n USING (normalized_name)
  JOIN display d USING (normalized_name)
  GROUP BY b.normalized_name, d.display_name, b.hour
  ORDER BY b.normalized_name, b.hour;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_by_hour(date, date, int[], int) TO authenticated;

-- -----------------------------------------------------
-- get_product_by_dow: same as above, by day of week
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_by_dow(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL,
  p_top_products int DEFAULT 10
)
RETURNS TABLE (
  normalized_name text,
  display_name text,
  dow smallint,
  quantity numeric,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      i.normalized_name,
      i.desc_sale_item,
      i.quantity,
      i.unit_price,
      i.id_sale,
      EXTRACT(DOW FROM s.shift_date)::smallint AS dow
    FROM saipos_sales_items i
    JOIN saipos_sales s ON s.id_sale = i.id_sale
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND i.deleted = false
      AND i.normalized_name IS NOT NULL
      AND i.normalized_name <> ''
      AND (p_sale_types IS NULL OR array_length(p_sale_types, 1) IS NULL OR i.id_sale_type = ANY(p_sale_types))
  ),
  top_n AS (
    SELECT normalized_name, SUM(quantity * unit_price) AS rev
    FROM base
    GROUP BY normalized_name
    ORDER BY rev DESC
    LIMIT p_top_products
  ),
  display AS (
    SELECT DISTINCT ON (b.normalized_name)
      b.normalized_name, b.desc_sale_item AS display_name
    FROM base b
    JOIN top_n USING (normalized_name)
    ORDER BY b.normalized_name, length(b.desc_sale_item) DESC
  )
  SELECT
    b.normalized_name,
    d.display_name,
    b.dow,
    SUM(b.quantity)::numeric AS quantity,
    COUNT(DISTINCT b.id_sale)::bigint AS orders
  FROM base b
  JOIN top_n USING (normalized_name)
  JOIN display d USING (normalized_name)
  GROUP BY b.normalized_name, d.display_name, b.dow
  ORDER BY b.normalized_name, b.dow;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_by_dow(date, date, int[], int) TO authenticated;

-- -----------------------------------------------------
-- get_top_addons: most-used add-ons / complementos
-- raw_payload.choices is an array; we unnest it.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_addons(
  p_start date,
  p_end date,
  p_sale_types int[] DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  addon_name text,
  uses bigint,
  total_additional_value numeric,
  parent_products text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expanded AS (
    SELECT
      LOWER(TRIM(COALESCE(c->>'desc_sale_item_choice', c->>'desc_store_choice_item', ''))) AS addon_name,
      COALESCE((c->>'aditional_price')::numeric, 0) AS aditional_price,
      i.normalized_name,
      i.desc_sale_item AS parent_display
    FROM saipos_sales_items i
    JOIN saipos_sales s ON s.id_sale = i.id_sale
    , LATERAL jsonb_array_elements(COALESCE(i.raw_payload->'choices', '[]'::jsonb)) AS c
    WHERE s.shift_date >= p_start
      AND s.shift_date <= p_end
      AND s.canceled = false
      AND i.deleted = false
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
        SELECT parent_display
        FROM expanded e2
        WHERE e2.addon_name = e1.addon_name
          AND e2.parent_display IS NOT NULL
        LIMIT 5
      ) t
    ) AS parent_products
  FROM expanded e1
  WHERE addon_name <> ''
  GROUP BY addon_name
  ORDER BY uses DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_addons(date, date, int[], int) TO authenticated;

-- -----------------------------------------------------
-- Index hint: the ARRAY_AGG over parent_products in get_top_addons
-- can be slow. If users complain, add:
--   CREATE INDEX idx_items_choices ON saipos_sales_items
--   USING GIN ((raw_payload->'choices'));
-- For now we leave it off — too speculative for a brand-new feature.
-- -----------------------------------------------------
