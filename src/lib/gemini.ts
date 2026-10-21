// Gemini API key rotator and request service.
// Supported environment setup:
// GEMINI_API_KEYS="key1,key2,key3"

import { aiFormatError, isAiFormatError, parseJsonLoose } from "./aiProviders/json";

export class GeminiRotatorService {
  private static getKeys(): string[] {
    const keysStr = process.env.GEMINI_API_KEYS || process.env.NEXT_PUBLIC_GEMINI_API_KEYS || "";
    return keysStr
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  private static currentKeyIndex = 0;

  /** Mask key for security logs (e.g. AQ.Ab8R...VTgSQ) */
  private static maskKey(key: string): string {
    if (key.length <= 12) return "******";
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  }

  // Make request with rotation and fallbacks
  public static async requestGemini(prompt: string, jsonMode: boolean = false, deadline?: number, requestTimeoutMs?: number): Promise<any> {
    return this.send(prompt, jsonMode, undefined, deadline, requestTimeoutMs);
  }

  // Vision variant: same rotation logic, but the prompt is paired with an image.
  public static async requestGeminiVision(
    prompt: string,
    imageBase64: string,
    mimeType: string = "image/jpeg",
    jsonMode: boolean = false,
    deadline?: number,
    requestTimeoutMs?: number
  ): Promise<any> {
    return this.send(prompt, jsonMode, { imageBase64, mimeType }, deadline, requestTimeoutMs);
  }

  /**
   * Shared upper bound for the whole request across every key, so the caller
   * returns before the platform's function timeout instead of a 504.
   */
  private static get totalBudgetMs(): number {
    const raw = Number(process.env.AI_TOTAL_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 5_000 ? raw : 120_000;
  }

  private static getModel(): string {
    return process.env.GEMINI_MODEL || "gemini-1.5-flash";
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

  private static async send(
    prompt: string,
    jsonMode: boolean = false,
    image?: { imageBase64: string; mimeType: string },
    deadline: number = Date.now() + GeminiRotatorService.totalBudgetMs,
    requestTimeoutMs?: number
  ): Promise<any> {
    const keys = this.getKeys();
    if (keys.length === 0) {
      throw new Error("No Gemini API keys found. Please set GEMINI_API_KEYS in your environment.");
    }

    const model = this.getModel();
    let attempts = 0;
    const maxAttempts = keys.length;
    let lastError = "";
    const baseTimeout = requestTimeoutMs && requestTimeoutMs >= 1_000 ? requestTimeoutMs : this.timeoutMs;

    while (attempts < maxAttempts) {
      if (Date.now() >= deadline) {
        throw new Error(`Gemini request exceeded the ${GeminiRotatorService.totalBudgetMs}ms time budget. Last error: ${lastError || "unknown"}`);
      }

      const activeKey = keys[this.currentKeyIndex];
      const maskedKey = this.maskKey(activeKey);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;

      console.log(`[GeminiRotator] Trying request with key index ${this.currentKeyIndex} (${maskedKey}). Attempt ${attempts + 1}/${maxAttempts}`);

      try {
        const parts: any[] = [{ text: prompt }];
        if (image?.imageBase64) {
          parts.push({
            inline_data: { mime_type: image.mimeType, data: image.imageBase64 },
          });
        }

        const body: any = {
          contents: [{ parts }],
        };

        if (jsonMode) {
          body.generationConfig = {
            responseMimeType: "application/json",
          };
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
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        // 1. Check for rate limit or quota exceeded
        if (response.status === 429) {
          console.warn(`[GeminiRotator] Key ${this.currentKeyIndex} (${maskedKey}) rate limited (429). Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        // 2. Check for other non-OK status codes (including key validation 400/403)
        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[GeminiRotator] Key ${this.currentKeyIndex} (${maskedKey}) failed with status ${response.status}: ${errText}. Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // 3. Check for empty or invalid response text
        if (!text || text.trim().length === 0) {
          console.warn(`[GeminiRotator] Key ${this.currentKeyIndex} (${maskedKey}) returned empty/invalid response. Rotating key.`);
          this.rotateKey(keys.length);
          attempts++;
          continue;
        }

        console.log(`[GeminiRotator] Key ${this.currentKeyIndex} (${maskedKey}) succeeded!`);
        
        if (jsonMode) {
          // The request returned 200, so the key is healthy. A non-JSON body
          // here is the model ignoring `responseMimeType`, not a key fault — this
          // used to throw into the catch below, rotate every remaining key, and
          // report the outcome as a total credential failure.
          const parsed = parseJsonLoose(text);
          if (parsed === undefined) {
            throw aiFormatError(
              "The AI model returned a non-JSON response for a JSON request. The key is healthy; the model's output format is not."
            );
          }
          return parsed;
        }
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
          `[GeminiRotator] ${isTimeout ? "Timeout" : "Connection/Parsing error"} with key index ${this.currentKeyIndex} (${maskedKey}):`,
          reason
        );
        this.rotateKey(keys.length);
        attempts++;
        lastError = reason;
        if (attempts >= maxAttempts) {
          throw new Error(`All available Gemini API keys failed. Last error: ${lastError}`);
        }
      }
    }

    throw new Error(
      lastError
        ? `All available Gemini API keys failed. Last error: ${lastError}`
        : "Gemini request failed due to unknown reasons after rotating through all keys."
    );
  }

  private static rotateKey(totalKeys: number) {
    const oldIndex = this.currentKeyIndex;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % totalKeys;
    console.log(`[GeminiRotator] Rotating API key index: ${oldIndex} -> ${this.currentKeyIndex}`);
  }
}
