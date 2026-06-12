
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS asym_slot_index integer,
  ADD COLUMN IF NOT EXISTS asym_format text,
  ADD COLUMN IF NOT EXISTS asym_prompt text,
  ADD COLUMN IF NOT EXISTS asym_source_session_id text,
  ADD COLUMN IF NOT EXISTS asym_submissions jsonb,
  ADD COLUMN IF NOT EXISTS asym_phase_started_at timestamptz;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS asym_submission text,
  ADD COLUMN IF NOT EXISTS asym_vote_target text;

CREATE TABLE IF NOT EXISTS public.asymmetry_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asymmetry_prompts TO authenticated, anon;
GRANT ALL ON public.asymmetry_prompts TO service_role;

ALTER TABLE public.asymmetry_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asym_prompts_select_all" ON public.asymmetry_prompts;
CREATE POLICY "asym_prompts_select_all" ON public.asymmetry_prompts FOR SELECT USING (true);

-- Seed 60 prompts (15 per format)
INSERT INTO public.asymmetry_prompts (format, prompt) VALUES
-- Crowd-Pleaser (15)
('crowd_pleaser', 'Most overrated movie of all time?'),
('crowd_pleaser', 'Most overrated band of all time?'),
('crowd_pleaser', 'Worst pizza topping?'),
('crowd_pleaser', 'Most useless kitchen gadget?'),
('crowd_pleaser', 'Worst fashion trend of the last decade?'),
('crowd_pleaser', 'Most pointless app on your phone?'),
('crowd_pleaser', 'Worst cereal ever invented?'),
('crowd_pleaser', 'Most annoying sound in the world?'),
('crowd_pleaser', 'Worst holiday tradition?'),
('crowd_pleaser', 'Most overrated tourist destination?'),
('crowd_pleaser', 'Worst smell that somehow exists in nature?'),
('crowd_pleaser', 'Most useless college major?'),
('crowd_pleaser', 'Worst song that gets stuck in your head?'),
('crowd_pleaser', 'Most disappointing fast food chain?'),
('crowd_pleaser', 'Worst icebreaker question at a party?'),
-- Two Truths & a Lie (15 — these are coaching prompts for the source)
('two_truths', 'Two true things and one lie about your childhood.'),
('two_truths', 'Two true things and one lie about your worst job.'),
('two_truths', 'Two true things and one lie about a place you''ve traveled.'),
('two_truths', 'Two true things and one lie about something you can do.'),
('two_truths', 'Two true things and one lie about a celebrity you''ve met or seen.'),
('two_truths', 'Two true things and one lie about your school days.'),
('two_truths', 'Two true things and one lie about a food you''ve eaten.'),
('two_truths', 'Two true things and one lie about something embarrassing.'),
('two_truths', 'Two true things and one lie about a pet you''ve had.'),
('two_truths', 'Two true things and one lie about your family.'),
('two_truths', 'Two true things and one lie about a hobby you''ve tried.'),
('two_truths', 'Two true things and one lie about a concert or event you went to.'),
('two_truths', 'Two true things and one lie about an injury you''ve had.'),
('two_truths', 'Two true things and one lie about a dream you remember.'),
('two_truths', 'Two true things and one lie about something you own.'),
-- Hot Take Defense (15)
('hot_take', 'Cereal is a soup.'),
('hot_take', 'Pineapple belongs on pizza.'),
('hot_take', 'Die Hard is a Christmas movie.'),
('hot_take', 'Socks with sandals should be legal.'),
('hot_take', 'Hot dogs are sandwiches.'),
('hot_take', 'A poptart is a ravioli.'),
('hot_take', 'Birds aren''t real.'),
('hot_take', 'Mayo is the best condiment.'),
('hot_take', 'Cats are better than dogs.'),
('hot_take', 'Showering at night beats showering in the morning.'),
('hot_take', 'The book is rarely better than the movie.'),
('hot_take', 'Coffee is overrated.'),
('hot_take', 'Reply-all is sometimes the right move.'),
('hot_take', 'Cilantro tastes like soap and it''s disgusting.'),
('hot_take', 'Open-plan offices should be illegal.'),
-- Finish The Sentence (15)
('finish_sentence', '____ would instantly ruin a first date.'),
('finish_sentence', 'Never trust a person who ____.'),
('finish_sentence', '____ is the worst thing to hear from your dentist.'),
('finish_sentence', 'The fastest way to clear a room is to ____.'),
('finish_sentence', 'You know the vacation is over when ____.'),
('finish_sentence', '____ should never be allowed in a hot tub.'),
('finish_sentence', 'The real reason aliens haven''t visited is ____.'),
('finish_sentence', 'My superpower would be useless if I could only ____.'),
('finish_sentence', '____ is the most cursed sandwich filling.'),
('finish_sentence', 'You can tell a wedding is doomed when ____.'),
('finish_sentence', 'In my next life, I''m coming back as ____.'),
('finish_sentence', 'The worst thing to find in your salad is ____.'),
('finish_sentence', 'A truly terrible band name would be ____.'),
('finish_sentence', '____ should require a license to do in public.'),
('finish_sentence', 'The villain''s origin story always starts with ____.');
