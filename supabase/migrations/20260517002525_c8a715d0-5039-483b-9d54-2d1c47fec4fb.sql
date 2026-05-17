
-- 1. Enum app_role
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Backfill admins existentes
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- 5. RLS para user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles - insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles - update"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles - delete"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Profiles: substituir policy de SELECT pela versão sem recursão
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 7. Trigger handle_new_user: novo user vira operador por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'operador'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 8. advisor_insights: adicionar user_id, backfill, NOT NULL, RLS estrita
ALTER TABLE public.advisor_insights ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.advisor_insights
SET user_id = (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE public.advisor_insights ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Authenticated users see insights" ON public.advisor_insights;
DROP POLICY IF EXISTS "Authenticated users dismiss insights" ON public.advisor_insights;

CREATE POLICY "Users see own insights"
ON public.advisor_insights FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users dismiss own insights"
ON public.advisor_insights FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 9. DRE / Dashboards / Saipos / clau_tool_logs: somente admin
-- saipos_sales
DROP POLICY IF EXISTS "Authenticated users can select saipos_sales" ON public.saipos_sales;
CREATE POLICY "Admins select saipos_sales" ON public.saipos_sales FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_sales_items
DROP POLICY IF EXISTS "Authenticated users can select saipos_sales_items" ON public.saipos_sales_items;
CREATE POLICY "Admins select saipos_sales_items" ON public.saipos_sales_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_status_history
DROP POLICY IF EXISTS "Authenticated users can select saipos_status_history" ON public.saipos_status_history;
CREATE POLICY "Admins select saipos_status_history" ON public.saipos_status_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_financial
DROP POLICY IF EXISTS "Authenticated users can select saipos_financial" ON public.saipos_financial;
CREATE POLICY "Admins select saipos_financial" ON public.saipos_financial FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_financial_imports
DROP POLICY IF EXISTS "Authenticated insert imports" ON public.saipos_financial_imports;
DROP POLICY IF EXISTS "Authenticated select imports" ON public.saipos_financial_imports;
DROP POLICY IF EXISTS "Authenticated delete imports" ON public.saipos_financial_imports;
CREATE POLICY "Admins select sfi" ON public.saipos_financial_imports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert sfi" ON public.saipos_financial_imports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete sfi" ON public.saipos_financial_imports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_financial_manual
DROP POLICY IF EXISTS "Authenticated insert sfm" ON public.saipos_financial_manual;
DROP POLICY IF EXISTS "Authenticated select sfm" ON public.saipos_financial_manual;
DROP POLICY IF EXISTS "Authenticated delete sfm" ON public.saipos_financial_manual;
CREATE POLICY "Admins select sfm" ON public.saipos_financial_manual FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert sfm" ON public.saipos_financial_manual FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete sfm" ON public.saipos_financial_manual FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_config
DROP POLICY IF EXISTS "Authenticated users can select saipos_config" ON public.saipos_config;
DROP POLICY IF EXISTS "Authenticated users can insert saipos_config" ON public.saipos_config;
DROP POLICY IF EXISTS "Authenticated users can update saipos_config" ON public.saipos_config;
CREATE POLICY "Admins select saipos_config" ON public.saipos_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert saipos_config" ON public.saipos_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update saipos_config" ON public.saipos_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_sync_runs
DROP POLICY IF EXISTS "Authenticated users can select saipos_sync_runs" ON public.saipos_sync_runs;
CREATE POLICY "Admins select saipos_sync_runs" ON public.saipos_sync_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- saipos_backfill_progress
DROP POLICY IF EXISTS "Authenticated users can select saipos_backfill_progress" ON public.saipos_backfill_progress;
CREATE POLICY "Admins select saipos_backfill_progress" ON public.saipos_backfill_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- dre_snapshot
DROP POLICY IF EXISTS "Authenticated select dre_snapshot" ON public.dre_snapshot;
DROP POLICY IF EXISTS "Authenticated insert dre_snapshot" ON public.dre_snapshot;
DROP POLICY IF EXISTS "Authenticated delete dre_snapshot" ON public.dre_snapshot;
CREATE POLICY "Admins select dre_snapshot" ON public.dre_snapshot FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert dre_snapshot" ON public.dre_snapshot FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete dre_snapshot" ON public.dre_snapshot FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- dre_snapshot_imports
DROP POLICY IF EXISTS "Authenticated select dre_snap_imp" ON public.dre_snapshot_imports;
DROP POLICY IF EXISTS "Authenticated insert dre_snap_imp" ON public.dre_snapshot_imports;
CREATE POLICY "Admins select dre_snap_imp" ON public.dre_snapshot_imports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert dre_snap_imp" ON public.dre_snapshot_imports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clau_tool_logs
DROP POLICY IF EXISTS "Authenticated read clau_tool_logs" ON public.clau_tool_logs;
CREATE POLICY "Admins read clau_tool_logs" ON public.clau_tool_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
