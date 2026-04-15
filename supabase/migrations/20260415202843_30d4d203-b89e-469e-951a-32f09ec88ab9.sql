CREATE TABLE public.custom_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select custom_statuses"
ON public.custom_statuses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert custom_statuses"
ON public.custom_statuses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update custom_statuses"
ON public.custom_statuses FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete custom_statuses"
ON public.custom_statuses FOR DELETE TO authenticated USING (true);

INSERT INTO public.custom_statuses (value, label, color, display_order, is_default) VALUES
  ('agendado', 'Agendado', '#3B82F6', 1, true),
  ('nao_iniciado', 'Não iniciado', '#6B7280', 2, true),
  ('em_andamento', 'Em andamento', '#F97316', 3, true),
  ('concluido', 'Concluído', '#22C55E', 4, true);