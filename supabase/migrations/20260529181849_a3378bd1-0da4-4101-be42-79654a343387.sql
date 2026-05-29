
-- Tables
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  current_category text,
  is_paused boolean NOT NULL DEFAULT false,
  host_session_id text NOT NULL,
  host_last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_room_code_idx ON public.rooms (room_code);
CREATE INDEX rooms_created_at_idx ON public.rooms (created_at);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  session_id text NOT NULL,
  avatar_url text,
  score int NOT NULL DEFAULT 0,
  is_audience boolean NOT NULL DEFAULT false,
  streak_count int NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, session_id)
);
CREATE INDEX players_room_id_idx ON public.players (room_id);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  subcategory text,
  question_text text NOT NULL,
  correct_answer text NOT NULL,
  wrong_1 text NOT NULL,
  wrong_2 text NOT NULL,
  wrong_3 text NOT NULL,
  media_url text,
  media_type text,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_category_idx ON public.questions (category, is_premium);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium boolean NOT NULL DEFAULT false,
  premium_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read (lookup by code), anyone can create, only host (by session_id) can update.
CREATE POLICY "rooms_select_all" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert_all" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update_all" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

-- Players: anyone in a room can read roster; anyone can insert/update their own row by session_id (enforced server-side).
CREATE POLICY "players_select_all" ON public.players FOR SELECT USING (true);
CREATE POLICY "players_insert_all" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update_all" ON public.players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "players_delete_all" ON public.players FOR DELETE USING (true);

-- Questions: non-premium readable by all; premium readable by all (gated in-app via category picker).
CREATE POLICY "questions_select_all" ON public.questions FOR SELECT USING (true);

-- Profiles: user can read/update only their own.
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;

-- pg_cron cleanup: delete rooms older than 24h hourly (players cascade)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-old-rooms',
  '0 * * * *',
  $$DELETE FROM public.rooms WHERE created_at < now() - interval '24 hours';$$
);
