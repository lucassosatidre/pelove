-- =====================================================
-- Saipos cron job setup
-- =====================================================
-- pg_cron + pg_net are already enabled in `extensions` schema.
-- This migration provides 2 helper functions:
--   1. public.schedule_saipos_crons(url, key) — sets up the 3 cron jobs
--   2. public.unschedule_saipos_crons() — removes them
--
-- The functions are SECURITY DEFINER so an authenticated frontend user
-- can call them via supabase.rpc() to (re)configure cron jobs without
-- holding superuser privileges.
--
-- They are NOT auto-executed here because we need the project's edge
-- function URL and an auth key — those are passed by the frontend (which
-- has them via VITE_SUPABASE_URL) when the user clicks "Ativar
-- sincronização automática".
-- =====================================================

CREATE OR REPLACE FUNCTION public.schedule_saipos_crons(
  p_functions_url text,
  p_auth_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := rtrim(p_functions_url, '/');
  v_jobs jsonb := '[]'::jsonb;
  v_job_id bigint;
BEGIN
  -- Drop old jobs first (idempotent)
  PERFORM extensions.cron.unschedule(jobid)
  FROM extensions.cron.job
  WHERE jobname IN (
    'saipos_cron_incremental',
    'saipos_cron_daily',
    'saipos_cron_old_data_check'
  );

  -- Incremental: every 30 minutes (24h, the function decides if it's "business hours" based on config in the future)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_incremental',
    '*/30 * * * *',
    format(
      $sql$
      SELECT extensions.net.http_post(
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

  -- Daily: every day at 04:00 (server time, usually UTC in Supabase)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_daily',
    '0 4 * * *',
    format(
      $sql$
      SELECT extensions.net.http_post(
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

  -- Weekly: Sundays at 05:00 — old data check (90-day window by default)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_old_data_check',
    '0 5 * * 0',
    format(
      $sql$
      SELECT extensions.net.http_post(
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
SET search_path = public, extensions
AS $$
DECLARE
  v_removed text[] := ARRAY[]::text[];
  v_jobname text;
BEGIN
  FOR v_jobname IN
    SELECT jobname
    FROM extensions.cron.job
    WHERE jobname IN (
      'saipos_cron_incremental',
      'saipos_cron_daily',
      'saipos_cron_old_data_check'
    )
  LOOP
    PERFORM extensions.cron.unschedule(v_jobname);
    v_removed := array_append(v_removed, v_jobname);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'removed', v_removed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unschedule_saipos_crons() TO authenticated;

-- Helper to inspect existing cron jobs from the frontend
CREATE OR REPLACE FUNCTION public.list_saipos_crons()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  jobid bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT j.jobname, j.schedule, j.active, j.jobid
  FROM extensions.cron.job j
  WHERE j.jobname LIKE 'saipos_cron_%'
  ORDER BY j.jobname;
$$;

GRANT EXECUTE ON FUNCTION public.list_saipos_crons() TO authenticated;
