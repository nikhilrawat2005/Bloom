/**
 * Parses a model response that was requested as JSON but may be wrapped in
 * prose or fenced code. Returns `undefined` when nothing JSON-like can be
 * recovered.
 *
 * Providers that requested `response_format: { type: "json_object" }` still
 * routinely emit markdown fences or a sentence of preamble around the payload.
 * Treating that as a hard failure is what caused healthy API keys to be ejected
 * from the rotation pool in `openrouter.ts` and `groq.ts`: the HTTP call had
 * already succeeded, so the fault was the model's formatting, not the
 * credential. Salvaging first turns most of those into successful requests.
 */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to the salvage attempts below.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Fall through.
    }
  }

  // First balanced { ... } or [ ... ] span in the text.
  const start = trimmed.search(/[{[]/);
  if (start !== -1) {
    const open = trimmed[start];
    const close = open === "{" ? "}" : "]";
    const end = trimmed.lastIndexOf(close);
    if (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // Fall through.
      }
    }
  }

  return undefined;
}

/** True when the error signals a model output-format problem, not a bad key. */
export function isAiFormatError(err: unknown): boolean {
  return Boolean(err && (err as { isAiFormatError?: boolean }).isAiFormatError);
}

/** Builds an error that `isAiFormatError` recognises. */
export function aiFormatError(message: string): Error {
  const err = new Error(message);
  (err as Error & { isAiFormatError?: boolean }).isAiFormatError = true;
  return err;
}
