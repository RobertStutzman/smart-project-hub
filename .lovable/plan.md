## Bump category-nudge storage key so it shows again

In `src/routes/host.tsx`, change:
- `CAT_NUDGE_KEY = "dt:host:cat-nudge-seen"` → `"dt:host:cat-nudge-seen:v2"`

Existing hosts (including the user) will see the "psst — you can pick your categories!" arrow again on next load. Auto-dismiss on opening Settings is unchanged.