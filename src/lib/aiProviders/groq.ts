// Groq API key rotator and request service (primary AI provider).
// Supported environment setup:
// GROQ_API_KEYS="key1,key2,key3"
// GROQ_MODEL="llama-3.1-8b-instant" (optional override)

import { aiFormatError, isAiFormatError, parseJsonLoose } from "./json";

export class GroqService {
  private static getKeys(): string[] {
    const keysStr = process.env.GROQ_API_KEYS || "";
    return keysStr
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  private static currentKeyIndex = 0;

  private static getModel(): string {
    return process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  }

  /**
   * Upstream timeout. Without one, an accepted-but-never-answered request holds
   * the whole rotation open and the key is counted as neither success nor
   * failure.
   */
  private static get timeoutMs(): number {
    const raw = Number(process.env.AI_REQUEST_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 1_000 ? raw : 45_000;
  }

  /** Mask key for security logs */
  private static maskKey(key: string): string {
    if (key.length <= 12) return "******";
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  }

  /**
   * Shared upper bound for the whole request across every key, so the caller
   * returns before the platform's function timeout instead of a 504.
   */
  private static get totalBudgetMs(): number {
    const raw = Number(process.env.AI_TOTAL_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 5_000 ? raw : 120_000;
  }

  public static async request(prompt: string, jsonMode: boolean = false, deadline: number = Date.now() + GroqService.totalBudgetMs, requestTimeoutMs?: number): Promise<any> {
    const keys = this.getKeys();
    if (keys.length === 0) {
      throw new Error("No Groq API keys found. Please set GROQ_API_KEYS in your environment.");
    }

    const model = this.getModel();
    let attempts = 0;
    const maxAttempts = keys.length;
    let lastError = "";
    const baseTimeout = requestTimeoutMs && requestTimeoutMs >= 1_000 ? requestTimeoutMs : this.timeoutMs;

    while (attempts < maxAttempts) {
      if (Date.now() >= deadline) {
        throw new Error(`Groq request exceeded the ${GroqService.totalBudgetMs}ms time budget. Last error: ${lastError || "unknown"}`);
      }

      const activeKey = keys[this.currentKeyIndex];
      const maskedKey = this.maskKey(activeKey);
      const url = "https://api.groq.com/openai/v1/chat/completions";

      console.log(`[GroqService] Trying request with key index ${this.currentKeyIndex} (${maskedKey}). Attempt ${attempts + 1}/${maxAttempts}`);

      try {
        const body: any = {
          model,
          messages: [{ role: "user", content: prompt }],
        };

        if (jsonMode) {
          body.response_format = { type: "json_object" };
        }

        const timeoutMs = Math.max(1_000, Math.min(baseTimeout, deadline - Date.now()));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${activeKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        // 1. Rate limit or quota exceeded
        if (response.status === 429) {
          console.warn(`[GroqService] Key ${this.currentKeyIndex} (${maskedKey}) rate limited (429). Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        // 2. Other non-OK status codes (auth failures, invalid model, etc.)
        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[GroqService] Key ${this.currentKeyIndex} (${maskedKey}) failed with status ${response.status}: ${errText}. Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;

        // 3. Empty or invalid response text
        if (!text || text.trim().length === 0) {
          console.warn(`[GroqService] Key ${this.currentKeyIndex} (${maskedKey}) returned empty/invalid response. Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        if (jsonMode) {
          // The call already returned 200 with a valid body, so this key is
          // healthy. Non-JSON here is the model ignoring `response_format`, not
          // a key fault — the old code rotated on it, burning a working
          // credential on a formatting problem and reporting the result as a
          // total key failure. Salvage first, then fail loudly.
          const parsed = parseJsonLoose(text);
          if (parsed === undefined) {
            throw aiFormatError(
              "The AI model returned a non-JSON response for a JSON request. The key is healthy; the model's output format is not."
            );
          }
          console.log(`[GroqService] Key ${this.currentKeyIndex} (${maskedKey}) succeeded!`);
          return parsed;
        }

        console.log(`[GroqService] Key ${this.currentKeyIndex} (${maskedKey}) succeeded!`);
        return text;
      } catch (err: any) {
        // Never rotate on a model-format failure: every remaining key would hit
        // the same formatting problem and the user would see a misleading
        // "all keys failed".
        if (isAiFormatError(err)) {
          throw err;
        }
        const isTimeout = err?.name === "AbortError";
        const reason = isTimeout ? `timed out after ${baseTimeout}ms` : err?.message || String(err);
        console.error(
          `[GroqService] ${isTimeout ? "Timeout" : "Connection/parsing error"} with key index ${this.currentKeyIndex} (${maskedKey}):`,
          reason
        );
        this.rotateKey(keys.length);
        attempts++;
        lastError = reason;
        if (attempts >= maxAttempts) {
          throw new Error(`All available Groq API keys failed. Last error: ${lastError}`);
        }
      }
    }

    throw new Error(
      lastError
        ? `All available Groq API keys failed. Last error: ${lastError}`
        : "Groq request failed due to unknown reasons after rotating through all keys."
    );
  }

  private static rotateKey(totalKeys: number) {
    const oldIndex = this.currentKeyIndex;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % totalKeys;
    console.log(`[GroqService] Rotating API key index: ${oldIndex} -> ${this.currentKeyIndex}`);
  }
}
