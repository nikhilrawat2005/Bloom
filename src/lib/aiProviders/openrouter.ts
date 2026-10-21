// OpenRouter API key rotator and request service (Double Queue Alternating Bucket System).
// Bucket Architecture:
// - Queue-A (Primary Bucket): Starts full with all configured keys.
// - Queue-B (Standby / Replenishing Bucket): Starts completely empty.
// - Workflow: Active bucket keys serve requests. Whenever a key hits 429/error, it is EJECTED from the
//   active bucket and transferred to the standby bucket for cooldown.
// - Zero Leakage Rule: The standby bucket is NEVER touched until the active bucket is COMPLETELY EMPTY.
// - When the active bucket reaches 0 keys, roles instantly SWAP (Standby becomes Active, and the old bucket becomes the new empty bucket).

import { aiFormatError, isAiFormatError, parseJsonLoose } from "./json";

export interface KeyTelemetry {
  index: number;
  keyId: string;
  maskedKey: string;
  currentBucket: "Queue-A (Active)" | "Queue-B (Replenishing)" | "Queue-B (Active)" | "Queue-A (Replenishing)";
  status: "idle" | "in_use" | "cooling_down" | "exhausted";
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  estimatedTokens: number;
  lastUsedAt?: string;
  cooldownUntil?: number;
}

/**
 * Thrown when OpenRouter says the configured model does not exist (404).
 * This is a config problem, not a key problem, so it must never eject keys.
 */
class OpenRouterModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterModelError";
  }
}

export class OpenRouterService {
  private static telemetry: Map<number, KeyTelemetry> = new Map();

  // Dynamic Double-Queue State
  private static activeBucket: "A" | "B" = "A";
  private static queueA: number[] = [];
  private static queueB: number[] = [];
  private static initialized = false;

  /**
   * Upstream timeout. Without one, a connection that is accepted but never
   * answered holds the request open until the platform kills it, and the key is
   * counted as neither success nor failure.
   */
  private static get timeoutMs(): number {
    const raw = Number(process.env.AI_REQUEST_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 1_000 ? raw : 45_000;
  }

  public static getAllKeys(): string[] {
    const indexed: string[] = [];
    for (let i = 1; i <= 16; i++) {
      const k = process.env[`OPENROUTER_API_KEY_${i}` as keyof NodeJS.ProcessEnv] as string | undefined;
      if (k && k.trim().length > 10) indexed.push(k.trim());
    }
    if (indexed.length > 0) return indexed;
    const keysStr = process.env.OPENROUTER_API_KEYS || "";
    return keysStr
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 10);
  }

  /**
   * Initializes Double Queue Buckets:
   * Starts with Queue-A FULL of all keys [0..N-1], and Queue-B completely EMPTY.
   */
  private static initQueues() {
    if (this.initialized) return;
    const keys = this.getAllKeys();
    this.queueA = keys.map((_, i) => i);
    this.queueB = [];
    this.activeBucket = "A";

    keys.forEach((key, index) => {
      this.telemetry.set(index, {
        index,
        keyId: `OPENROUTER_API_KEY_${index + 1}`,
        maskedKey: this.maskKey(key),
        currentBucket: "Queue-A (Active)",
        status: "idle",
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        estimatedTokens: 0,
      });
    });

    this.initialized = true;
  }

  private static maskKey(key: string): string {
    if (key.length <= 12) return "******";
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  }

  private static getModel(): string {
    return process.env.OPENROUTER_MODEL || "openrouter/free";
  }

  /**
   * Ordered list of models to try. A configured paid router (e.g.
   * `openrouter/auto`) can answer 402 Payment Required for every key when the
   * account is out of credits — a model/account fault, not a key fault. Retrying
   * the same key against a free router keeps the request alive instead of
   * burning all credentials on a 504. Override the tail with
   * OPENROUTER_FALLBACK_MODELS (comma-separated).
   */
  private static getModelChain(): string[] {
    const primary = this.getModel().trim();
    const chain = [primary];
    const seen = new Set(chain);
    const fallback = process.env.OPENROUTER_FALLBACK_MODELS || "openrouter/free";
    for (const model of fallback.split(",").map((m) => m.trim()).filter(Boolean)) {
      if (!seen.has(model)) {
        chain.push(model);
        seen.add(model);
      }
    }
    return chain;
  }

  /**
   * Shared upper bound for a whole request across every key. Guarantees the
   * caller returns before the platform's function timeout, unlike per-key
   * limits which multiply by the number of configured keys.
   */
  private static get totalBudgetMs(): number {
    const raw = Number(process.env.AI_TOTAL_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 5_000 ? raw : 120_000;
  }

  /**
   * Cap on generated output tokens. OpenRouter otherwise defaults max_tokens to
   * the model's full ceiling (e.g. 131072); a budget account then answers 402
   * "You requested up to 131072 tokens, but can only afford ..." even when the
   * actual output is tiny. Capping keeps paid routers affordable AND bounds
   * latency on slow fallback models. Undefined via OPENROUTER_MAX_TOKENS="".
   */
  private static get maxTokens(): number | undefined {
    const raw = process.env.OPENROUTER_MAX_TOKENS;
    if (raw === undefined || raw === "") return 8192;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 256 ? Math.round(n) : 8192;
  }

  private static getVisionModel(): string {
    const model = process.env.OPENROUTER_VISION_MODEL;
    if (!model || model.trim().length === 0) {
      throw new Error("No vision model configured. Set OPENROUTER_VISION_MODEL to enable image analysis.");
    }
    return model;
  }

  /**
   * Eject key from active bucket into the fallback bucket upon 429/error.
   */
  private static ejectKeyToFallback(keyIndex: number, cooldownSeconds: number = 30) {
    const tel = this.telemetry.get(keyIndex);
    if (tel) {
      tel.status = "cooling_down";
      tel.cooldownUntil = Date.now() + cooldownSeconds * 1000;
    }

    if (this.activeBucket === "A") {
      this.queueA = this.queueA.filter((idx) => idx !== keyIndex);
      if (!this.queueB.includes(keyIndex)) {
        this.queueB.push(keyIndex);
      }
      if (tel) tel.currentBucket = "Queue-B (Replenishing)";
      console.warn(`[OpenRouterService] ⚠️ Key #${keyIndex + 1} ejected from Queue-A -> transferred to Queue-B. Remaining in Queue-A: ${this.queueA.length}`);
    } else {
      this.queueB = this.queueB.filter((idx) => idx !== keyIndex);
      if (!this.queueA.includes(keyIndex)) {
        this.queueA.push(keyIndex);
      }
      if (tel) tel.currentBucket = "Queue-A (Replenishing)";
      console.warn(`[OpenRouterService] ⚠️ Key #${keyIndex + 1} ejected from Queue-B -> transferred to Queue-A. Remaining in Queue-B: ${this.queueB.length}`);
    }
  }

  /**
   * A key is only allowed to serve once its cooldown has elapsed.
   */
  private static isCoolingDown(index: number): boolean {
    const tel = this.telemetry.get(index);
    if (!tel?.cooldownUntil) return false;
    return tel.cooldownUntil > Date.now();
  }

  /** Milliseconds until the earliest key becomes usable again. */
  private static shortestCooldownMs(): number {
    const now = Date.now();
    let shortest = Infinity;
    for (const tel of this.telemetry.values()) {
      if (tel.cooldownUntil && tel.cooldownUntil > now) {
        shortest = Math.min(shortest, tel.cooldownUntil - now);
      }
    }
    return shortest === Infinity ? 0 : shortest;
  }

  /** First key in `list` that is actually allowed to serve right now. */
  private static firstEligible(list: number[]): number | undefined {
    return list.find((index) => !this.isCoolingDown(index));
  }

  /**
   * Check if active bucket has a usable key. If not, trigger full failover swap
   * to the standby bucket.
   */
  private static ensureActiveBucket(): boolean {
    const currentActiveList = this.activeBucket === "A" ? this.queueA : this.queueB;

    // 1. If active bucket has an eligible key right now, proceed
    if (this.firstEligible(currentActiveList) !== undefined) {
      return true;
    }

    // 2. If active bucket has keys but all are cooling down, check if cooldown is short
    // or if we should check standby bucket
    const nextBucket = this.activeBucket === "A" ? "B" : "A";
    const nextList = nextBucket === "A" ? this.queueA : this.queueB;

    // If standby bucket has keys, perform the SWAP!
    if (nextList.length > 0) {
      console.log(`[OpenRouterService] 🔄 Active Queue-${this.activeBucket} exhausted/empty! Swapping to Queue-${nextBucket} (${nextList.length} keys).`);
      this.activeBucket = nextBucket;

      // On swapping to the new active bucket, clear expired cooldowns or make the earliest keys ready
      nextList.forEach((idx) => {
        const tel = this.telemetry.get(idx);
        if (tel) {
          tel.currentBucket = `${nextBucket === "A" ? "Queue-A" : "Queue-B"} (Active)` as any;
          // If the cooldown already passed or was transferred earlier, make available
          if (!this.isCoolingDown(idx)) {
            tel.status = "idle";
          }
        }
      });

      // If an eligible key is ready right now, return true
      if (this.firstEligible(nextList) !== undefined) {
        return true;
      }

      // If all keys in the newly active list still have cooldown, reset the cooldown
      // of the key that has cooled down the longest so requests don't hard-crash
      let bestKey = nextList[0];
      let lowestCooldown = Infinity;
      const now = Date.now();
      for (const idx of nextList) {
        const tel = this.telemetry.get(idx);
        const remaining = (tel?.cooldownUntil || 0) - now;
        if (remaining < lowestCooldown) {
          lowestCooldown = remaining;
          bestKey = idx;
        }
      }

      const bestTel = this.telemetry.get(bestKey);
      if (bestTel) {
        bestTel.cooldownUntil = undefined;
        bestTel.status = "idle";
        console.log(`[OpenRouterService] Activated earliest-cooling key #${bestKey + 1} in swapped Queue-${nextBucket}`);
        return true;
      }
    }

    // 3. If active list still has keys (standby is empty) but all are cooling down,
    // pick the key that has cooled down the longest if it has been waiting
    if (currentActiveList.length > 0) {
      let bestKey = currentActiveList[0];
      let lowestCooldown = Infinity;
      const now = Date.now();
      for (const idx of currentActiveList) {
        const tel = this.telemetry.get(idx);
        const remaining = (tel?.cooldownUntil || 0) - now;
        if (remaining < lowestCooldown) {
          lowestCooldown = remaining;
          bestKey = idx;
        }
      }

      // If remaining cooldown is under 5 seconds, clear it and try
      if (lowestCooldown <= 5000) {
        const bestTel = this.telemetry.get(bestKey);
        if (bestTel) {
          bestTel.cooldownUntil = undefined;
          bestTel.status = "idle";
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns current telemetry and queue status for Admin Dashboard.
   */
  public static getTelemetryData() {
    this.initQueues();
    const items = Array.from(this.telemetry.values());

    const activeList = this.activeBucket === "A" ? this.queueA : this.queueB;
    const standbyList = this.activeBucket === "A" ? this.queueB : this.queueA;

    return {
      activeQueue: this.activeBucket,
      totalKeys: items.length,
      primaryBucket: {
        name: `Bucket ${this.activeBucket} (Active Serving)`,
        keysRemaining: activeList.length,
        status: activeList.length > 0 ? "Active Serving" : "Empty (Swapping)",
        keys: activeList.map((idx) => items.find((k) => k.index === idx)!),
      },
      fallbackBucket: {
        name: `Bucket ${this.activeBucket === "A" ? "B" : "A"} (Replenishing Standby)`,
        keysCount: standbyList.length,
        status: standbyList.length > 0 
          ? (activeList.length === 0 ? "Swapping to Active" : "Filling on fallback (Locked until Active is empty)") 
          : "Empty (Pristine)",
        keys: standbyList.map((idx) => items.find((k) => k.index === idx)!),
      },
      allKeys: items,
      summary: {
        totalRequests: items.reduce((acc, k) => acc + k.totalRequests, 0),
        totalSuccessful: items.reduce((acc, k) => acc + k.successfulRequests, 0),
        totalFailed: items.reduce((acc, k) => acc + k.failedRequests, 0),
        totalEstimatedTokens: items.reduce((acc, k) => acc + k.estimatedTokens, 0),
      },
    };
  }

  public static async request(prompt: string, jsonMode: boolean = false, deadline?: number, requestTimeoutMs?: number): Promise<any> {
    return this.send(prompt, jsonMode, undefined, deadline, requestTimeoutMs);
  }

  /** Vision variant. Requires OPENROUTER_VISION_MODEL to be set. */
  public static async requestVision(
    prompt: string,
    imageBase64: string,
    mimeType: string = "image/jpeg",
    jsonMode: boolean = false,
    deadline?: number,
    requestTimeoutMs?: number
  ): Promise<any> {
    return this.send(prompt, jsonMode, { imageBase64, mimeType }, deadline, requestTimeoutMs);
  }

  private static async send(
    prompt: string,
    jsonMode: boolean = false,
    image?: { imageBase64: string; mimeType: string },
    deadline: number = Date.now() + OpenRouterService.totalBudgetMs,
    requestTimeoutMs?: number
  ): Promise<any> {
    const keys = this.getAllKeys();
    if (keys.length === 0) {
      throw new Error("No OpenRouter API keys found. Please set OPENROUTER_API_KEYS in your environment.");
    }

    this.initQueues();
    const models = image ? [this.getVisionModel()] : this.getModelChain();
    let modelIndex = 0;
    let model = models[modelIndex];
    let maxTokens: number | undefined = this.maxTokens;
    let attempts = 0;
    // One pass over every key plus one retry pass, since a key can fail
    // transiently without being exhausted.
    const maxAttempts = keys.length * 2;
    let lastError = "";
    // A caller may grant a slow-but-working model more headroom per attempt.
    // Without this, a model that legitimately needs ~60s is aborted at the 45s
    // default, the key is ejected, and the retry repeats the same slow model
    // until the whole-time budget is gone.
    const baseTimeout = requestTimeoutMs && requestTimeoutMs >= 1_000 ? requestTimeoutMs : this.timeoutMs;

    while (attempts < maxAttempts) {
      if (Date.now() >= deadline) {
        throw new Error(`OpenRouter request exceeded the ${OpenRouterService.totalBudgetMs}ms time budget. Last error: ${lastError || "unknown"}`);
      }

      const hasAvailable = this.ensureActiveBucket();
      if (!hasAvailable) {
        const waitMs = this.shortestCooldownMs();
        if (waitMs > 0 && waitMs <= 6000) {
          await new Promise((r) => setTimeout(r, Math.min(waitMs + 200, 6000)));
          attempts++;
          continue;
        }
        
        // If wait is longer, release the earliest cooling key so the user is never stranded
        const activeList = this.activeBucket === "A" ? this.queueA : this.queueB;
        const targetList = activeList.length > 0 ? activeList : (this.activeBucket === "A" ? this.queueB : this.queueA);
        if (targetList.length > 0) {
          const earliestKey = targetList[0];
          const tel = this.telemetry.get(earliestKey);
          if (tel) {
            tel.cooldownUntil = undefined;
            tel.status = "idle";
            attempts++;
            continue;
          }
        }

        throw new Error(
          `OpenRouter API rate limit reached. Next available key frees up in ${Math.ceil(waitMs / 1000)}s.`
        );
      }

      // Pick the first key currently allowed to serve at the front of the active bucket
      const activeList = this.activeBucket === "A" ? this.queueA : this.queueB;
      const keyIndex = this.firstEligible(activeList);
      if (keyIndex === undefined) {
        // ensureActiveBucket already returned true, so this is unreachable in
        // practice; fail closed rather than indexing with undefined.
        attempts++;
        continue;
      }
      const activeKey = keys[keyIndex];
      const maskedKey = this.maskKey(activeKey);
      const tel = this.telemetry.get(keyIndex)!;

      tel.status = "in_use";
      tel.totalRequests++;
      tel.lastUsedAt = new Date().toISOString();

      const url = "https://openrouter.ai/api/v1/chat/completions";
      console.log(`[OpenRouterService] [Queue-${this.activeBucket} Active] Request using key #${keyIndex + 1} (${maskedKey}). Bucket remaining: ${activeList.length}`);

      try {
        const content: any = image
          ? [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.imageBase64}` } },
            ]
          : prompt;

        const body: any = {
          model,
          messages: [{ role: "user", content }],
        };

        if (jsonMode) {
          body.response_format = { type: "json_object" };
        }
        if (maxTokens !== undefined) {
          body.max_tokens = maxTokens;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        };

        if (process.env.NEXT_PUBLIC_APP_URL) {
          headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
        }
        if (process.env.NEXT_PUBLIC_APP_NAME) {
          headers["X-Title"] = process.env.NEXT_PUBLIC_APP_NAME;
        }

        const timeoutMs = Math.max(1_000, Math.min(baseTimeout, deadline - Date.now()));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        const promptTokens = Math.ceil(prompt.length / 4);

        // 400 (invalid/bad model), 402 (out of credits) and 404 (model removed)
        // are model/request faults: every key fails identically, so advance to
        // the next model in the chain WITHOUT ejecting the key or burning an
        // attempt.
        if (response.status === 400 || response.status === 402 || response.status === 404) {
          const errText = await response.text();
          tel.status = "idle";
          // A cheap fallback model may cap output below our max_tokens. Drop the
          // cap and retry the same model/key instead of rejecting the whole chain.
          if (response.status === 400 && maxTokens !== undefined && /max[_ ]tokens|maximum|context length|too long/i.test(errText)) {
            console.warn(`[OpenRouterService] Model "${model}" rejected max_tokens=${maxTokens}. Retrying without the cap.`);
            lastError = `Model "${model}" 400 max_tokens: ${errText.slice(0, 200)}`;
            maxTokens = undefined;
            continue;
          }
          const nextModel = models[modelIndex + 1];
          if (nextModel) {
            console.warn(
              `[OpenRouterService] Model "${model}" unavailable (${response.status}). Falling back to "${nextModel}". Response: ${errText.slice(0, 200)}`
            );
            lastError = `Model "${model}" ${response.status}: ${errText.slice(0, 200)}`;
            modelIndex++;
            model = nextModel;
            continue;
          }
          console.error(
            `[OpenRouterService] Model "${model}" ${response.status} and no fallback models remain. Response: ${errText.slice(0, 300)}`
          );
          throw new OpenRouterModelError(
            `OpenRouter model "${model}" failed (${response.status}). Set OPENROUTER_MODEL to a working model such as "openrouter/free".`
          );
        }

        if (response.status === 429) {
          lastError = `Rate limit (429) hit on key #${keyIndex + 1}`;
          console.warn(`[OpenRouterService] Key #${keyIndex + 1} (${maskedKey}) rate limited (429). Ejecting to fallback bucket.`);
          tel.failedRequests++;
          this.ejectKeyToFallback(keyIndex, 30);
          attempts++;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `Status ${response.status}: ${errText.slice(0, 200)}`;
          console.warn(`[OpenRouterService] Key #${keyIndex + 1} (${maskedKey}) failed status ${response.status}: ${errText}. Ejecting.`);
          tel.failedRequests++;
          this.ejectKeyToFallback(keyIndex, response.status === 401 ? 120 : 30);
          attempts++;
          continue;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;

        if (!text || text.trim().length === 0) {
          lastError = `Empty response received from key #${keyIndex + 1}`;
          console.warn(`[OpenRouterService] Key #${keyIndex + 1} returned empty content.`);
          tel.failedRequests++;
          this.ejectKeyToFallback(keyIndex, 15);
          attempts++;
          continue;
        }

        // Record successful token consumption
        const completionTokens = Math.ceil(text.length / 4);
        const actualUsage = data?.usage?.total_tokens || (promptTokens + completionTokens);
        tel.estimatedTokens += actualUsage;
        tel.successfulRequests++;
        tel.status = "idle";

        if (jsonMode) {
          // The key just answered 200 with a valid body, so it is healthy. If the
          // payload is not JSON that is the model ignoring `response_format`, not
          // a key fault — the old code ejected the key anyway, which burned a
          // working credential on a formatting problem and masked the real cause
          // behind "all keys failed". Salvage first, then fail loudly.
          const parsed = parseJsonLoose(text);
          if (parsed === undefined) {
            tel.failedRequests++;
            tel.status = "idle";
            throw aiFormatError(
              "The AI model returned a non-JSON response for a JSON request. The key is healthy; the model's output format is not."
            );
          }
          return parsed;
        }

        return text;
      } catch (err: any) {
        // A format failure is a request bug, not a key fault: rethrow without
        // ejecting so one bad key cannot cascade into a total outage.
        if (isAiFormatError(err) || err instanceof OpenRouterModelError) {
          throw err;
        }
        const isTimeout = err?.name === "AbortError";
        lastError = isTimeout
          ? `timed out after ${baseTimeout}ms`
          : err?.message || String(err);
        console.error(
          `[OpenRouterService] ${isTimeout ? "Timeout" : "Connection error"} with key #${keyIndex + 1}:`,
          lastError
        );
        tel.failedRequests++;
        // A timeout means the credential authenticated fine but the upstream was
        // slow, so cool it down briefly instead of parking it for minutes.
        this.ejectKeyToFallback(keyIndex, isTimeout ? 1 : 3);
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            `All available OpenRouter keys failed. Last error: ${lastError}`
          );
        }
      }
    }

    throw new Error(
      lastError
        ? `All available OpenRouter keys failed. Last error: ${lastError}`
        : "OpenRouter request failed across alternating queue cycles."
    );
  }
}
