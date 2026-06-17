// Shared normalization for question-text duplicate detection.
// Lowercase, trim, collapse whitespace, strip punctuation so that
// "Who painted the Mona Lisa?" matches "who painted the mona lisa".
export function dedupeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize an answer string for bucketing semantic-duplicate candidates.
// Same shape as dedupeKey but kept as a separate name so the intent at the
// call-site is obvious.
export function normalizeAnswer(s: string): string {
  return dedupeKey(s);
}
