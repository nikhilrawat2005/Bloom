/**
 * promptGuard.ts
 *
 * Single source of truth for neutralizing untrusted text before it is
 * interpolated into an LLM prompt (scraped pages, card metadata, resume text,
 * chat history). Strips the constructs a prompt-injection payload would use
 * to close the surrounding fence or impersonate a control tag, then trims.
 *
 * Used by: /api/ai, /api/summarize, batchSummarizer, ingestion/normalize,
 * resumeAnalyzerService.
 */

/** Strip the fences a prompt-injection payload would try to close. */
export function neutralize(text: unknown, max: number): string {
  return String(text ?? "")
    .replace(/"""/g, "\u201d\u201d\u201d")
    .replace(/```/g, "\u02bc\u02bc\u02bc")
    .replace(/<\/?(?:system|assistant|user|document)>/gi, "")
    .trim()
    .slice(0, max);
}
