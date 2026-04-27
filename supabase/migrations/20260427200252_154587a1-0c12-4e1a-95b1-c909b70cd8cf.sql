-- ========== Migration 1: saipos_mirror_tables ==========
CREATE TABLE public.saipos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint,
  is_enabled boolean NOT NULL DEFAULT false,
  backfill_start_date date DEFAULT '2024-09-01',
  backfill_completed_at timestamptz,
  old_data_check_enabled boolean NOT NULL DEFAULT true,
  old_data_check_window_days integer NOT NULL DEFAULT 90,
  last_incremental_sync_at timestamptz,
  last_daily_sync_at timestamptz,
  last_old_data_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saipos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select saipos_config" ON public.saipos_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert saipos_config" ON public.saipos_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update saipos_config" ON public.saipos_config FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.saipos_sync_runs (
  id bigserial PRIMARY KEY,
  run_type text NOT NULL,
  endpoint text NOT NULL,
  date_column text,
  period_start timestamptz,
  period_end timestamptz,
  http_status integer,
  records_received integer DEFAULT 0,
  records_upserted integer DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer
);
CREATE INDEX idx_sync_runs_started ON public.saipos_sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON public.saipos_sync_runs(status, started_at DESC);
CREATE INDEX idx_sync_runs_type ON public.saipos_sync_runs(run_type, started_at DESC);
ALTER TABLE public.saipos_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select saipos_sync_runs" ON public.saipos_sync_runs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.saipos_backfill_progress (
  id bigserial PRIMARY KEY,
  endpoint text NOT NULL,
  window_start date NOT NULL,
  window_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  records_imported integer DEFAULT 0,
  error_message text,
  attempted_at timestamptz,
  completed_at timestamptz,
  UNIQUE (endpoint, window_start, window_end)
);
CREATE INDEX idx_backfill_status ON public.saipos_backfill_progress(status, window_start);
ALTER TABLE public.saipos_backfill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select saipos_backfill_progress" ON public.saipos_backfill_progress FOR SELECT TO authenticated USING (true);

CREATE TABLE public.saipos_sales (
  id_sale bigint PRIMARY KEY,
  id_store bigint,
  id_sale_type smallint,
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
  partner_desc text,
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
CREATE POLICY "Authenticated users can select saipos_sales" ON public.saipos_sales FOR SELECT TO authenticated USING (true);

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
  status smallint,
  deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by bigint,
  created_by bigint,
  id_store_waiter bigint,
  group_sequence bigint,
  id_sale_to bigint,
  id_sale_from bigint,
  id_store_cancellation_reason bigint,
  normalized_name text,
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
CREATE POLICY "Authenticated users can select saipos_sales_items" ON public.saipos_sales_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.saipos_status_history (
  id_sale_status_history bigint PRIMARY KEY,
  id_sale bigint NOT NULL,
  id_store bigint,
  shift_date date,
  history_created_at timestamptz,
  display_order integer,
  duration_time_seconds integer,
  desc_store_sale_status text,
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
CREATE POLICY "Authenticated users can select saipos_status_history" ON public.saipos_status_history FOR SELECT TO authenticated USING (true);

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
CREATE POLICY "Authenticated users can select saipos_financial" ON public.saipos_financial FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saipos_config_updated_at
BEFORE UPDATE ON public.saipos_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.saipos_config (store_id, is_enabled, backfill_start_date)
VALUES (42566, false, '2024-09-01');

-- ========== Migration 2: saipos_cron_setup ==========
-- Note: pg_cron creates the `cron` schema regardless of the install schema.
-- We must reference cron.job / cron.schedule unqualified by db (no extensions. prefix).
CREATE OR REPLACE FUNCTION public.schedule_saipos_crons(
  p_functions_url text,
  p_auth_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
DECLARE
  v_url text := rtrim(p_functions_url, '/');
  v_jobs jsonb := '[]'::jsonb;
  v_job_id bigint;
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN (
    'saipos_cron_incremental',
    'saipos_cron_daily',
    'saipos_cron_old_data_check'
  );

  v_job_id := cron.schedule(
    'saipos_cron_incremental',
    '*/30 * * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb,
        timeout_milliseconds := 60000
      );
      $sql$,
      v_url || '/saipos-cron?mode=incremental',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_auth_key
      ),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_incremental', 'id', v_job_id, 'schedule', '*/30 * * * *');

  v_job_id := cron.schedule(
    'saipos_cron_daily',
    '0 4 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb,
        timeout_milliseconds := 120000
      );
      $sql$,
      v_url || '/saipos-cron?mode=daily',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_auth_key
      ),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_daily', 'id', v_job_id, 'schedule', '0 4 * * *');

  v_job_id := cron.schedule(
    'saipos_cron_old_data_check',
    '0 5 * * 0',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb,
        timeout_milliseconds := 300000
      );
      $sql$,
      v_url || '/saipos-cron?mode=old_data_check',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_auth_key
      ),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_old_data_check', 'id', v_job_id, 'schedule', '0 5 * * 0');

  RETURN jsonb_build_object('success', true, 'jobs', v_jobs);
END;
$$;
GRANT EXECUTE ON FUNCTION public.schedule_saipos_crons(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unschedule_saipos_crons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
DECLARE
  v_removed text[] := ARRAY[]::text[];
  v_jobname text;
BEGIN
  FOR v_jobname IN
    SELECT jobname FROM cron.job
    WHERE jobname IN (
      'saipos_cron_incremental',
      'saipos_cron_daily',
      'saipos_cron_old_data_check'
    )
  LOOP
    PERFORM cron.unschedule(v_jobname);
    v_removed := array_append(v_removed, v_jobname);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'removed', v_removed);
END;
$$;
GRANT EXECUTE ON FUNCTION public.unschedule_saipos_crons() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_saipos_crons()
RETURNS TABLE (jobname text, schedule text, active boolean, jobid bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
  SELECT j.jobname, j.schedule, j.active, j.jobid
  FROM cron.job j
  WHERE j.jobname LIKE 'saipos_cron_%'
  ORDER BY j.jobname;
$$;
GRANT EXECUTE ON FUNCTION public.list_saipos_crons() TO authenticated;