# Diagnose missing lobby quips on the QR page

## What I did NOT change in the last edit
- Quip cadence (still 10s first tick + 10s interval on a fresh lobby).
- `pickLobbyLine` pool for `count === 0` (now `IDLE_EMPTY + IDLE_JOIN_NUDGE + IDLE_GENERIC`, strictly larger than before).
- `tick()` body, `isElfSpeaking()` gate, `pendingQuips` counter.

So the 10s loop should still be firing. The likely cause it *sounds* dead:

1. The lobby effect queues **welcome intro + scan opener** back-to-back. Each is ~3–6s of TTS. The first tick fires at +10s, sees `isElfSpeaking() === true`, and skips. The 20s tick should then fire — but if either line is still draining (or a new welcome got queued by the persona-handoff replay branch), every tick keeps hitting the busy gate.
2. Possible secondary issue: on `/dev` the host loads inside an iframe; autoplay/voice may be gated until interaction.

## Plan

### Step 1 — Confirm by logging
Ask the user to run this in the host-frame console once, then sit on the QR page for ~40s:

```
localStorage.setItem('btd:voice-debug','1'); location.reload();
```

That flips on the existing `dlog()` calls in `host.tsx`, so we'll see `welcome`, `opener queued`, `skip: busy`, `skip: pending`, `queued: …`, `finished`. The pattern tells us whether ticks are firing-and-skipping vs. not firing at all.

### Step 2 — Fix based on what the logs show

**If ticks are firing but always `skip: busy`** (welcome+opener never clear):
- Shorten the lobby opening so quips can land. Two options, pick whichever the user prefers:
  - Drop the welcome intro on the QR page and keep only the scan opener, OR
  - Tighten welcome+opener to a single combined line (e.g. just `pickWelcomeIntro()` and skip the explicit "scan the QR" since the QR is already huge on screen).
- Also lower `firstQuipDelay` to ~14s so the first quip lands shortly after the opener finishes instead of getting eaten by it.

**If ticks aren't firing at all** (no `tick` log):
- The lobby effect is being torn down/re-mounted (likely from a `room` re-fetch). Stabilize the effect deps and confirm with one more reload.

**If no logs appear at all**:
- The voice module never loaded / autoplay is blocked in the `/dev` iframe. Reproduce on `/host` directly (no iframe) to rule it out, and add a one-time user-gesture unlock if needed.

### Step 3 — Verify
Reload the QR page, sit for ~40s, confirm at least 2 quips play. No code changes get made until the logs in Step 1 tell us which branch of Step 2 to take.

## Why I'm not just patching blindly
Changing cadence/intros again without the diagnostic risks "fixing" the wrong thing and breaking the welcome-intro pacing you signed off on earlier. One log session pins it.
