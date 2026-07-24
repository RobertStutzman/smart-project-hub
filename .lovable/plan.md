## Plan

1. **Make Vox catchphrase baking resumable**
   - Change the catchphrase baker so it processes a small batch at a time instead of trying all remaining lines in one long server call.
   - Keep the existing “skip already baked” behavior so it can be clicked/restarted safely.

2. **Add progress + failure visibility in Admin Sounds**
   - Update the Vox catchphrase button flow to loop through batches, similar to the question voiceover baker.
   - Show live progress like `Baking catchphrases… 35 / 268`.
   - Show a concise error count and keep going when individual lines fail.

3. **Make “remaining 268” actually finish**
   - Add a server-side `limit` option for Vox baking, defaulting to a safe small batch.
   - Return `generated`, `skipped`, `errors`, `remaining`, and `total` so the UI knows whether to continue.
   - Avoid one huge request that can timeout before the final catchphrases are saved.

4. **Improve error reporting without touching other systems**
   - Surface the first few failed line names/messages in the toast instead of a giant hidden failure.
   - Do not change gameplay audio, question voiceover baking, scoring, security findings, or database schema.

5. **Verify**
   - Run the relevant TypeScript check automatically after implementation.
   - If possible, test the baker endpoint behavior with a very small batch size so we can confirm it returns progress instead of hanging.