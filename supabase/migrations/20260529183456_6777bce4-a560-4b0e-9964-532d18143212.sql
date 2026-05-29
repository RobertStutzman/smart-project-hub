-- Storage bucket for player selfies (public so host TV can render them)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read avatars
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Anyone (anon player) can upload an avatar — server fn validates ownership before
-- writing the avatar_url to the players row. Limit by bucket only here.
CREATE POLICY "avatars_anon_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_anon_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');