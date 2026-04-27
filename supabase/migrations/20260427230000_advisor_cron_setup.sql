-- =====================================================
-- Advisor: cron job for daily insights generation
-- =====================================================
-- Adds a 4th job (besides the 3 saipos_cron_*) that triggers
-- advisor-generate-insights every day at 05:30 — after the
-- daily Saipos sync at 04:00, so insights have fresh data.
-- =====================================================

-- Extend schedule_saipos_crons to also schedule the insights job.
-- We keep the same RPC name so the frontend "Agendar crons" button
-- sets up everything in one click.
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
  PERFORM extensions.cron.unschedule(jobname)
  FROM extensions.cron.job
  WHERE jobname IN (
    'saipos_cron_incremental',
    'saipos_cron_daily',
    'saipos_cron_old_data_check',
    'advisor_daily_insights'
  );

  -- Saipos incremental (every 30 min)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_incremental',
    '*/30 * * * *',
    format(
      $sql$ SELECT extensions.net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 60000); $sql$,
      v_url || '/saipos-cron?mode=incremental',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_incremental', 'id', v_job_id, 'schedule', '*/30 * * * *');

  -- Saipos daily (04h)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_daily',
    '0 4 * * *',
    format(
      $sql$ SELECT extensions.net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 120000); $sql$,
      v_url || '/saipos-cron?mode=daily',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_daily', 'id', v_job_id, 'schedule', '0 4 * * *');

  -- Saipos old-data check (Sunday 05h)
  v_job_id := extensions.cron.schedule(
    'saipos_cron_old_data_check',
    '0 5 * * 0',
    format(
      $sql$ SELECT extensions.net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 300000); $sql$,
      v_url || '/saipos-cron?mode=old_data_check',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'saipos_cron_old_data_check', 'id', v_job_id, 'schedule', '0 5 * * 0');

  -- Advisor daily insights (05:30, after Saipos daily sync)
  v_job_id := extensions.cron.schedule(
    'advisor_daily_insights',
    '30 5 * * *',
    format(
      $sql$ SELECT extensions.net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 120000); $sql$,
      v_url || '/advisor-generate-insights',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || p_auth_key),
      '{}'::jsonb
    )
  );
  v_jobs := v_jobs || jsonb_build_object('name', 'advisor_daily_insights', 'id', v_job_id, 'schedule', '30 5 * * *');

  RETURN jsonb_build_object('success', true, 'jobs', v_jobs);
END;
$$;

-- Update unschedule and list helpers to include the advisor job
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
    SELECT jobname FROM extensions.cron.job
    WHERE jobname IN (
      'saipos_cron_incremental',
      'saipos_cron_daily',
      'saipos_cron_old_data_check',
      'advisor_daily_insights'
    )
  LOOP
    PERFORM extensions.cron.unschedule(v_jobname);
    v_removed := array_append(v_removed, v_jobname);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'removed', v_removed);
END;
$$;

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
  WHERE j.jobname LIKE 'saipos_cron_%' OR j.jobname = 'advisor_daily_insights'
  ORDER BY j.jobname;
$$;
