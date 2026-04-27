-- =====================================================
-- Saipos mirror schema
-- =====================================================
-- Local mirror of Saipos data (sales, items, status history, financial).
-- All API responses are upserted here so dashboards query Postgres,
-- not the Saipos API directly.
--
-- Sync flow:
--   1. saipos-historical-backfill (one-shot, ~Set/2024 → today)
--   2. cron incremental every 30min, business hours
--   3. cron daily 04h, last 7 days (catches edits)
--   4. cron weekly sunday 04h, last 90 days (catches old edits)
-- =====================================================

-- -----------------------------------------------------
-- saipos_config — single row, integration settings
-- -----------------------------------------------------
CREATE TABLE public.saipos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint,
  is_enabled boolean NOT NULL DEFAULT false,

  -- Backfill window (inclusive)
  backfill_start_date date DEFAULT '2024-09-01',
  backfill_completed_at timestamptz,

  -- Old-data check (weekly retro check)
  old_data_check_enabled boolean NOT NULL DEFAULT true,
  old_data_check_window_days integer NOT NULL DEFAULT 90,

  last_incremental_sync_at timestamptz,
  last_daily_sync_at timestamptz,
  last_old_data_check_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saipos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_config"
ON public.saipos_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert saipos_config"
ON public.saipos_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update saipos_config"
ON public.saipos_config FOR UPDATE TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_sync_runs — execution log
-- -----------------------------------------------------
CREATE TABLE public.saipos_sync_runs (
  id bigserial PRIMARY KEY,
  run_type text NOT NULL,
  -- 'backfill' | 'incremental' | 'daily' | 'old_data_check' | 'manual'

  endpoint text NOT NULL,
  -- 'sales' | 'sales_items' | 'sales_status_histories' | 'financial'

  date_column text,
  -- 'shift_date' | 'created_at' | 'updated_at' | 'date'

  period_start timestamptz,
  period_end timestamptz,

  http_status integer,
  records_received integer DEFAULT 0,
  records_upserted integer DEFAULT 0,

  status text NOT NULL DEFAULT 'running',
  -- 'running' | 'success' | 'error'
  error_message text,

  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer
);

CREATE INDEX idx_sync_runs_started ON public.saipos_sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON public.saipos_sync_runs(status, started_at DESC);
CREATE INDEX idx_sync_runs_type ON public.saipos_sync_runs(run_type, started_at DESC);

ALTER TABLE public.saipos_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_sync_runs"
ON public.saipos_sync_runs FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_backfill_progress — resumable historical load
-- -----------------------------------------------------
CREATE TABLE public.saipos_backfill_progress (
  id bigserial PRIMARY KEY,
  endpoint text NOT NULL,
  window_start date NOT NULL,
  window_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'running' | 'success' | 'error'
  records_imported integer DEFAULT 0,
  error_message text,
  attempted_at timestamptz,
  completed_at timestamptz,
  UNIQUE (endpoint, window_start, window_end)
);

CREATE INDEX idx_backfill_status ON public.saipos_backfill_progress(status, window_start);

ALTER TABLE public.saipos_backfill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_backfill_progress"
ON public.saipos_backfill_progress FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_sales — one row per sale
-- -----------------------------------------------------
CREATE TABLE public.saipos_sales (
  id_sale bigint PRIMARY KEY,
  id_store bigint,
  id_sale_type smallint,
  -- 1=Entrega, 2=Balcão/Takeout, 3=Salão, 4=Ficha

  sale_number integer,
  desc_sale text,

  created_at timestamptz,
  updated_at timestamptz,
  shift_date date,

  total_amount numeric(12, 2),
  total_amount_items numeric(12, 2),
  total_discount numeric(12, 2),
  total_increase numeric(12, 2),

  canceled boolean DEFAULT false,
  count_canceled_items integer DEFAULT 0,

  -- Hot-path denormalizations for fast dashboard queries
  customer_id_customer bigint,
  customer_name text,
  customer_phone text,
  customer_document text,

  store_shift_desc text,
  store_shift_starting_time text,

  delivery_fee numeric(12, 2),
  delivery_neighborhood text,
  delivery_city text,
  delivery_man_name text,

  partner_desc text,         -- iFood, Rappi, etc.
  partner_cod_sale1 text,
  partner_status text,

  table_id_table bigint,
  table_total_service_charge numeric(12, 2),
  table_service_charge_percent numeric(5, 2),
  table_customers_count integer,

  ticket_number integer,
  schedule_datetime timestamptz,

  nfce_serie text,
  nfce_numero integer,
  nfce_data_emissao timestamptz,

  -- Full original payload — never lost, used for reprocessing
  raw_payload jsonb NOT NULL,

  saipos_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_shift_date ON public.saipos_sales(shift_date DESC);
CREATE INDEX idx_sales_created_at ON public.saipos_sales(created_at DESC);
CREATE INDEX idx_sales_updated_at ON public.saipos_sales(updated_at DESC);
CREATE INDEX idx_sales_type ON public.saipos_sales(id_sale_type, shift_date DESC);
CREATE INDEX idx_sales_partner ON public.saipos_sales(partner_desc) WHERE partner_desc IS NOT NULL;
CREATE INDEX idx_sales_canceled ON public.saipos_sales(canceled, shift_date DESC);
CREATE INDEX idx_sales_customer ON public.saipos_sales(customer_id_customer) WHERE customer_id_customer IS NOT NULL;

ALTER TABLE public.saipos_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_sales"
ON public.saipos_sales FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_sales_items — one row per item per sale
-- -----------------------------------------------------
CREATE TABLE public.saipos_sales_items (
  id_sale_item bigint PRIMARY KEY,
  id_sale bigint NOT NULL,
  id_store bigint,
  id_sale_type smallint,

  shift_date date,
  item_created_at timestamptz,
  item_updated_at timestamptz,
  done_at timestamptz,

  id_store_item bigint,
  desc_sale_item text,
  integration_code text,
  id_store_variation bigint,

  quantity numeric(10, 3),
  unit_price numeric(12, 2),

  status smallint,            -- 0=Pendente, 1=Pronto
  deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by bigint,

  created_by bigint,
  id_store_waiter bigint,

  group_sequence bigint,

  id_sale_to bigint,
  id_sale_from bigint,
  id_store_cancellation_reason bigint,

  -- For dedup across channels (Salão/Delivery/iFood) — fills via trigger or app logic
  normalized_name text,

  -- choices/adicionais kept inside raw_payload for now
  raw_payload jsonb NOT NULL,

  saipos_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_sale ON public.saipos_sales_items(id_sale);
CREATE INDEX idx_items_shift_date ON public.saipos_sales_items(shift_date DESC);
CREATE INDEX idx_items_store_item ON public.saipos_sales_items(id_store_item);
CREATE INDEX idx_items_normalized ON public.saipos_sales_items(normalized_name) WHERE normalized_name IS NOT NULL;
CREATE INDEX idx_items_waiter ON public.saipos_sales_items(id_store_waiter) WHERE id_store_waiter IS NOT NULL;
CREATE INDEX idx_items_deleted ON public.saipos_sales_items(deleted, shift_date DESC);

ALTER TABLE public.saipos_sales_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_sales_items"
ON public.saipos_sales_items FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_status_history — one row per status change
-- -----------------------------------------------------
CREATE TABLE public.saipos_status_history (
  id_sale_status_history bigint PRIMARY KEY,
  id_sale bigint NOT NULL,
  id_store bigint,

  shift_date date,
  history_created_at timestamptz,

  display_order integer,         -- 'order' field — sequence in lifecycle
  duration_time_seconds integer, -- time spent in this status

  desc_store_sale_status text,   -- 'Cozinha', 'Pronto', 'Cancelado', etc.
  desc_cancellation_reason text,

  user_id_user bigint,
  user_full_name text,
  user_email text,
  user_type smallint,

  authorized_by_id_user bigint,
  authorized_by_full_name text,

  raw_payload jsonb NOT NULL,
  saipos_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_sale ON public.saipos_status_history(id_sale);
CREATE INDEX idx_history_shift_date ON public.saipos_status_history(shift_date DESC);
CREATE INDEX idx_history_status ON public.saipos_status_history(desc_store_sale_status, shift_date DESC);

ALTER TABLE public.saipos_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_status_history"
ON public.saipos_status_history FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- saipos_financial — financial transactions
-- -----------------------------------------------------
CREATE TABLE public.saipos_financial (
  id_store_fin_transaction bigint PRIMARY KEY,
  id_store bigint,

  date timestamptz,
  payment_date timestamptz,
  issuance_date timestamptz,
  created_at timestamptz,
  updated_at timestamptz,

  amount numeric(12, 2),
  paid boolean,
  conciliated boolean,
  recurring boolean,
  installment integer,
  total_installments integer,

  desc_store_fin_transaction text,
  desc_store_category_financial text,
  desc_store_payment_method text,
  desc_store_bank_account text,
  provider_trade_name text,

  notes text,

  raw_payload jsonb NOT NULL,
  saipos_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_date ON public.saipos_financial(date DESC);
CREATE INDEX idx_fin_payment_date ON public.saipos_financial(payment_date DESC);
CREATE INDEX idx_fin_paid ON public.saipos_financial(paid, date DESC);
CREATE INDEX idx_fin_category ON public.saipos_financial(desc_store_category_financial);
CREATE INDEX idx_fin_provider ON public.saipos_financial(provider_trade_name);

ALTER TABLE public.saipos_financial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saipos_financial"
ON public.saipos_financial FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------
-- updated_at trigger for config
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saipos_config_updated_at
BEFORE UPDATE ON public.saipos_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- Seed: insert default config row (single row pattern)
-- -----------------------------------------------------
INSERT INTO public.saipos_config (store_id, is_enabled, backfill_start_date)
VALUES (42566, false, '2024-09-01');
