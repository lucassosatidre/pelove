-- Add start_date to actions: when status = "agendado", action has two dates
-- (start_date = when the work begins, deadline = when it must be delivered).
-- For other statuses, only deadline is shown in the UI.

ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS start_date DATE;

COMMENT ON COLUMN public.actions.start_date IS
  'Optional planned start date. Used when status = agendado to show "Início → Prazo" in the bubble. NULL for other statuses or when no start was planned.';
