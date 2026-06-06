CREATE TABLE public.sound_clips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot text NOT NULL,
  label text NOT NULL,
  storage_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  volume real NOT NULL DEFAULT 0.7,
  loop boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX sound_clips_slot_active_idx ON public.sound_clips (slot, is_active);

GRANT SELECT ON public.sound_clips TO anon, authenticated;
GRANT ALL ON public.sound_clips TO service_role;

ALTER TABLE public.sound_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY sound_clips_select_all ON public.sound_clips
  FOR SELECT TO public USING (true);

CREATE POLICY sound_clips_admin_insert ON public.sound_clips
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sound_clips_admin_update ON public.sound_clips
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sound_clips_admin_delete ON public.sound_clips
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));