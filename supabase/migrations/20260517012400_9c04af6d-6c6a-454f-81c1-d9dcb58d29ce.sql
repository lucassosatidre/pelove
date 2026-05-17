
-- ============================================================
-- Fase 1 — Planejamento da Vida Pessoal
-- ============================================================

-- 1. personal_profile (1 linha por user)
CREATE TABLE public.personal_profile (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  age int,
  values jsonb NOT NULL DEFAULT '[]'::jsonb,
  energizes text,
  drains text,
  life_marker text,
  wizard_completed boolean NOT NULL DEFAULT false,
  wizard_step int NOT NULL DEFAULT 1,
  last_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp select own" ON public.personal_profile FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pp insert own" ON public.personal_profile FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp update own" ON public.personal_profile FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pp delete own" ON public.personal_profile FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER personal_profile_updated_at BEFORE UPDATE ON public.personal_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. life_pillars
CREATE TABLE public.life_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  priority smallint CHECK (priority BETWEEN 1 AND 5),
  vision_text text,
  horizon_years smallint NOT NULL DEFAULT 5,
  is_custom boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.life_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp select own" ON public.life_pillars FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lp insert own" ON public.life_pillars FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lp update own" ON public.life_pillars FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lp delete own" ON public.life_pillars FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX life_pillars_user_idx ON public.life_pillars(user_id);
CREATE TRIGGER life_pillars_updated_at BEFORE UPDATE ON public.life_pillars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. life_obstacles
CREATE TABLE public.life_obstacles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id uuid NOT NULL REFERENCES public.life_pillars(id) ON DELETE CASCADE,
  title text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.life_obstacles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lo select own" ON public.life_obstacles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lo insert own" ON public.life_obstacles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lo update own" ON public.life_obstacles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lo delete own" ON public.life_obstacles FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX life_obstacles_user_pillar_idx ON public.life_obstacles(user_id, pillar_id);
CREATE TRIGGER life_obstacles_updated_at BEFORE UPDATE ON public.life_obstacles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. life_actions
CREATE TABLE public.life_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id uuid REFERENCES public.life_pillars(id) ON DELETE CASCADE,
  obstacle_id uuid REFERENCES public.life_obstacles(id) ON DELETE SET NULL,
  title text NOT NULL,
  deadline date,
  status text NOT NULL DEFAULT 'nao_iniciado',
  mapped_to_strategic_action_id uuid REFERENCES public.actions(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.life_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la select own" ON public.life_actions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "la insert own" ON public.life_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "la update own" ON public.life_actions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "la delete own" ON public.life_actions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX life_actions_user_pillar_idx ON public.life_actions(user_id, pillar_id);
CREATE INDEX life_actions_mapped_idx ON public.life_actions(mapped_to_strategic_action_id);
CREATE TRIGGER life_actions_updated_at BEFORE UPDATE ON public.life_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. personal_people
CREATE TABLE public.personal_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  importance smallint CHECK (importance BETWEEN 1 AND 5),
  needs_alignment boolean NOT NULL DEFAULT false,
  notes text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pep select own" ON public.personal_people FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pep insert own" ON public.personal_people FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pep update own" ON public.personal_people FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pep delete own" ON public.personal_people FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX personal_people_user_idx ON public.personal_people(user_id);
CREATE TRIGGER personal_people_updated_at BEFORE UPDATE ON public.personal_people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. personal_milestones
CREATE TABLE public.personal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  target_date date,
  horizon_years smallint,
  pillar_id uuid REFERENCES public.life_pillars(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm select own" ON public.personal_milestones FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pm insert own" ON public.personal_milestones FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pm update own" ON public.personal_milestones FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pm delete own" ON public.personal_milestones FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX personal_milestones_user_idx ON public.personal_milestones(user_id);
CREATE TRIGGER personal_milestones_updated_at BEFORE UPDATE ON public.personal_milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. context_type em advisor_*
ALTER TABLE public.advisor_conversations ADD COLUMN context_type text NOT NULL DEFAULT 'empresa' CHECK (context_type IN ('empresa','vida'));
ALTER TABLE public.advisor_facts ADD COLUMN context_type text NOT NULL DEFAULT 'empresa' CHECK (context_type IN ('empresa','vida'));
ALTER TABLE public.advisor_insights ADD COLUMN context_type text NOT NULL DEFAULT 'empresa' CHECK (context_type IN ('empresa','vida'));
CREATE INDEX advisor_conversations_ctx_idx ON public.advisor_conversations(user_id, context_type);
CREATE INDEX advisor_facts_ctx_idx ON public.advisor_facts(user_id, context_type);
