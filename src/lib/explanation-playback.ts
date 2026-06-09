/**
 * Module-level signal so the reveal auto-advance hook can wait for the
 * "Did you know?" explanation TTS to actually finish before transitioning
 * out of the reveal phase. Without this, the hook's `isElfSpeaking()` poll
 * lands in the gap between queued persona reactions and the explanation,
 * sees "speech ended", and cuts the explanation off (most visible on
 * wildcard Q5 reveals because they always transition to leaderboard).
 */

type State = {
  qid: string | null;
  expected: boolean;
  started: boolean;
  ended: boolean;
};

const state: State = { qid: null, expected: false, started: false, ended: false };

export function resetExplanationFor(qid: string | null) {
  state.qid = qid;
  state.expected = false;
  state.started = false;
  state.ended = false;
}

export function markExplanationExpected(qid: string) {
  if (state.qid !== qid) resetExplanationFor(qid);
  state.expected = true;
}

export function markExplanationStarted(qid: string) {
  if (state.qid !== qid) return;
  state.started = true;
}

export function markExplanationEnded(qid: string) {
  if (state.qid !== qid) return;
  state.ended = true;
}

export function getExplanationStateFor(qid: string | null) {
  if (!qid || state.qid !== qid) {
    return { expected: false, started: false, ended: false };
  }
  return { expected: state.expected, started: state.started, ended: state.ended };
}
