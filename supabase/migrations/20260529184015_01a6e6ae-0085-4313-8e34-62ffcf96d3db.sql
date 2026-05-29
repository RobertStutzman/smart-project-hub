-- Gameplay state on rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'lobby',
  ADD COLUMN IF NOT EXISTS current_question_id uuid,
  ADD COLUMN IF NOT EXISTS question_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS question_duration_ms integer NOT NULL DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS dropped_indexes integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_answers text[],
  ADD COLUMN IF NOT EXISTS current_correct_index integer,
  ADD COLUMN IF NOT EXISTS current_question_text text,
  ADD COLUMN IF NOT EXISTS round_number integer NOT NULL DEFAULT 0;

-- Gameplay state on players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS current_answer integer,
  ADD COLUMN IF NOT EXISTS current_answer_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_round_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_round_fastest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_2x boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_2x boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_answer_correct boolean;

-- Track questions a room has already asked
CREATE TABLE IF NOT EXISTS public.room_questions (
  room_id uuid NOT NULL,
  question_id uuid NOT NULL,
  asked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, question_id)
);

GRANT SELECT ON public.room_questions TO anon, authenticated;
GRANT ALL ON public.room_questions TO service_role;

ALTER TABLE public.room_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_questions_select_all" ON public.room_questions;
CREATE POLICY "room_questions_select_all"
  ON public.room_questions FOR SELECT
  USING (true);