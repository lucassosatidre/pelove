
-- 1. Add user_id columns (nullable inicialmente para backfill)
ALTER TABLE public.vision ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pillars ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.obstacles ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.actions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.custom_statuses ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill: atribui tudo ao admin
DO $$
DECLARE
  v_admin uuid;
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE email = 'adm@pelove.com' LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'admin adm@pelove.com não encontrado';
  END IF;
  UPDATE public.vision SET user_id = v_admin WHERE user_id IS NULL;
  UPDATE public.pillars SET user_id = v_admin WHERE user_id IS NULL;
  UPDATE public.obstacles SET user_id = v_admin WHERE user_id IS NULL;
  UPDATE public.actions SET user_id = v_admin WHERE user_id IS NULL;
  UPDATE public.custom_statuses SET user_id = v_admin WHERE user_id IS NULL;
END $$;

-- 3. NOT NULL + DEFAULT auth.uid()
ALTER TABLE public.vision ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.pillars ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.obstacles ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.actions ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.custom_statuses ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 4. Indexes para performance
CREATE INDEX IF NOT EXISTS idx_vision_user_id ON public.vision(user_id);
CREATE INDEX IF NOT EXISTS idx_pillars_user_id ON public.pillars(user_id);
CREATE INDEX IF NOT EXISTS idx_obstacles_user_id ON public.obstacles(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON public.actions(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_statuses_user_id ON public.custom_statuses(user_id);

-- 5. Drop policies antigas (USING true) e cria policies estritas por user_id
-- VISION
DROP POLICY IF EXISTS "Authenticated users can select vision" ON public.vision;
DROP POLICY IF EXISTS "Authenticated users can insert vision" ON public.vision;
DROP POLICY IF EXISTS "Authenticated users can update vision" ON public.vision;
DROP POLICY IF EXISTS "Authenticated users can delete vision" ON public.vision;
CREATE POLICY "Users see own vision" ON public.vision FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own vision" ON public.vision FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own vision" ON public.vision FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own vision" ON public.vision FOR DELETE TO authenticated USING (user_id = auth.uid());

-- PILLARS
DROP POLICY IF EXISTS "Authenticated users can select pillars" ON public.pillars;
DROP POLICY IF EXISTS "Authenticated users can insert pillars" ON public.pillars;
DROP POLICY IF EXISTS "Authenticated users can update pillars" ON public.pillars;
DROP POLICY IF EXISTS "Authenticated users can delete pillars" ON public.pillars;
CREATE POLICY "Users see own pillars" ON public.pillars FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own pillars" ON public.pillars FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own pillars" ON public.pillars FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own pillars" ON public.pillars FOR DELETE TO authenticated USING (user_id = auth.uid());

-- OBSTACLES
DROP POLICY IF EXISTS "Authenticated users can select obstacles" ON public.obstacles;
DROP POLICY IF EXISTS "Authenticated users can insert obstacles" ON public.obstacles;
DROP POLICY IF EXISTS "Authenticated users can update obstacles" ON public.obstacles;
DROP POLICY IF EXISTS "Authenticated users can delete obstacles" ON public.obstacles;
CREATE POLICY "Users see own obstacles" ON public.obstacles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own obstacles" ON public.obstacles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own obstacles" ON public.obstacles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own obstacles" ON public.obstacles FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ACTIONS
DROP POLICY IF EXISTS "Authenticated users can select actions" ON public.actions;
DROP POLICY IF EXISTS "Authenticated users can insert actions" ON public.actions;
DROP POLICY IF EXISTS "Authenticated users can update actions" ON public.actions;
DROP POLICY IF EXISTS "Authenticated users can delete actions" ON public.actions;
CREATE POLICY "Users see own actions" ON public.actions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own actions" ON public.actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own actions" ON public.actions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own actions" ON public.actions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CUSTOM_STATUSES
DROP POLICY IF EXISTS "Authenticated users can select custom_statuses" ON public.custom_statuses;
DROP POLICY IF EXISTS "Authenticated users can insert custom_statuses" ON public.custom_statuses;
DROP POLICY IF EXISTS "Authenticated users can update custom_statuses" ON public.custom_statuses;
DROP POLICY IF EXISTS "Authenticated users can delete custom_statuses" ON public.custom_statuses;
CREATE POLICY "Users see own custom_statuses" ON public.custom_statuses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own custom_statuses" ON public.custom_statuses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own custom_statuses" ON public.custom_statuses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own custom_statuses" ON public.custom_statuses FOR DELETE TO authenticated USING (user_id = auth.uid());
