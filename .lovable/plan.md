## Raise CSV import limit from 500 to 1000

The CSV dropzone sends all parsed rows in a single `bulkInsertQuestions` call, and that server function validates `rows` with `z.array(...).min(1).max(500)`. An 800-row CSV fails Zod validation before any insert runs.

### Change

- `src/lib/admin.functions.ts` (line 155): bump `.max(500)` → `.max(1000)` on the `rows` array in the `bulkInsertQuestions` input validator.
- `src/routes/_authenticated/admin.tsx` (CsvDropzone, ~line 540): update the user-facing helper text / row-count guard if it mentions 500, so the dropzone rejects >1000 with a clear toast instead of a server error.

No DB schema, no auth, no batching changes. The Gemini importer already chunks its own inserts, so it's unaffected.

### Why 1000 and not higher

The bulk insert runs as a single transaction in one server function call. 1000 rows is comfortably within the Worker request/time budget; going much higher risks timeouts on slower networks. For larger one-time imports we'd want true client-side chunking, which we can add later if you regularly drop >1000 at once.