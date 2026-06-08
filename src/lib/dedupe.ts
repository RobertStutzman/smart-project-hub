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
