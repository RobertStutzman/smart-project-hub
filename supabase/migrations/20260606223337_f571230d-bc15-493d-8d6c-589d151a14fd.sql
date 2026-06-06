ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS current_question_tts_url text;