
DROP POLICY IF EXISTS questions_select_all ON public.questions;
CREATE POLICY questions_admin_select
  ON public.questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS room_questions_select_all ON public.room_questions;
CREATE POLICY room_questions_admin_select
  ON public.room_questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  correct_index integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.room_secrets TO service_role;

ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_secrets_no_client_access
  ON public.room_secrets FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS avatars_anon_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_anon_update ON storage.objects;
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;

CREATE POLICY avatars_scoped_insert
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'avatars'
    AND name ~ '^[A-Z]{4}/[A-Za-z0-9_-]+-\d{10,}\.(jpg|jpeg|png|webp)$'
  );

CREATE POLICY avatars_scoped_select
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'avatars'
    AND name ~ '^[A-Z]{4}/[A-Za-z0-9_-]+-\d{10,}\.(jpg|jpeg|png|webp)$'
  );

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS realtime_messages_deny_all ON realtime.messages;
CREATE POLICY realtime_messages_deny_all
  ON realtime.messages FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.list_question_categories() FROM anon, authenticated, public;
