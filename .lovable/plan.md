# Immediate next step: stop this run, publish the fixed build, then re-run

## What is happening

The screenshot still shows only repeated `phase.change { phase: "lobby" }` events and no `intro`. That is the same stuck symptom from the JSON.

The code fix for that bug has already been made locally and typechecked clean, but the custom domain build you are testing appears to still be the old published build. Frontend/client code changes require hitting Publish/Update before they are live on `droptrivia.app`.

## What you should do now

1. Hit **Stop** on the current batch.
2. Do **not** keep waiting; this run is not going to recover.
3. Approve this plan so I can publish the already-fixed build.
4. After publishing finishes, reload `https://droptrivia.app/dev`, enter the password if needed, and re-run **Batch run all**.

## What I will do on approval

- Run the required pre-publish security check.
- Publish/update the current build so the host iframe stale-closure fix is actually live on the custom domain.
- Tell you when publishing is scheduled and which URL to test.

## Expected after publish

- The runner should stop sitting in lobby-only events.
- After `Spawn 4`, `parent:start-game` should trigger `phase.change=intro` within 8 seconds.
- If it still fails, download JSON again and drop it here; then the failure will reflect the updated build and I can diagnose the next real issue.

## No code changes in this step

This is only deployment of the fixes already made.