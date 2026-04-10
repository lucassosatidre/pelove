ALTER TABLE public.pillars ADD COLUMN bg_color text DEFAULT NULL;
ALTER TABLE public.pillars ADD COLUMN text_color text DEFAULT NULL;
ALTER TABLE public.pillars ADD COLUMN is_bold boolean DEFAULT false;

ALTER TABLE public.obstacles ADD COLUMN bg_color text DEFAULT NULL;
ALTER TABLE public.obstacles ADD COLUMN text_color text DEFAULT NULL;
ALTER TABLE public.obstacles ADD COLUMN is_bold boolean DEFAULT false;

ALTER TABLE public.actions ADD COLUMN bg_color text DEFAULT NULL;
ALTER TABLE public.actions ADD COLUMN text_color text DEFAULT NULL;
ALTER TABLE public.actions ADD COLUMN is_bold boolean DEFAULT false;