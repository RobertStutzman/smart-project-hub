
-- Add media fields to rooms so the active question's media reaches host TV
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS current_media_url text,
  ADD COLUMN IF NOT EXISTS current_media_type text;

-- RLS policies for the question-media storage bucket.
-- Admin-only writes; reads stay server-side via signed URLs (no public select needed).
CREATE POLICY "question_media_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-media'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "question_media_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-media'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "question_media_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-media'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "question_media_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'question-media'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
