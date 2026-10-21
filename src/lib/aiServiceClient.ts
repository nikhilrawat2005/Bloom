import { authedFetch } from "@/lib/apiClient";
import type { PerformanceAssessment, SavedOpportunityMatch } from "@/lib/performanceTypes";
import type { ProfileEnrichment } from "@/lib/enrichmentTypes";

export interface ResumeAnalysisResult {
  atsScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  formattingFeedback: string;
  improvementSuggestions: string[];
}



/**
 * Thrown when the AI backend could not produce a real answer.
 *
 * This class used to swallow every failure and return a hardcoded, plausible
 * looking result — a fixed `atsScore: 65`, a canned chatbot reply, a canned
 * `confidenceScore: 70` — which the UI then rendered as if a model had produced
 * it. Fabricated scores are worse than no scores: a student acted on them.
 * Callers must handle this and show an honest "unavailable" state.
 */
export class AIServiceUnavailableError extends Error {
  readonly reason: string;
  constructor(reason: string, message?: string) {
    super(message || "The AI service is unavailable right now.");
    this.name = "AIServiceUnavailableError";
    this.reason = reason;
  }
}

export class AIServiceClient {
  private static async postRequest(action: string, data: unknown): Promise<any> {
    let response: Response;
    try {
      response = await authedFetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
    } catch (e) {
      console.error(`AI Client network error for action ${action}:`, e);
      throw new AIServiceUnavailableError("network", "Could not reach the AI service. Check your connection.");
    }

    if (!response.ok) {
      let message = `The AI service returned ${response.status}.`;
      try {
        const errData = await response.json();
        if (errData && typeof errData.error === "string" && errData.error.length > 0) {
          message = errData.error;
        }
      } catch {
        // non-JSON error body; keep the status-derived message
      }
      if (response.status === 401) {
        throw new AIServiceUnavailableError("unauthenticated", "Please sign in to use AI features.");
      }
      if (response.status === 429) {
        throw new AIServiceUnavailableError("rate_limited", "Too many AI requests. Wait a moment and try again.");
      }
      throw new AIServiceUnavailableError("provider", message);
    }

    const body = await response.json();
    return body?.result;
  }

  public static async analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
    const result = await this.postRequest("analyzeResume", { resumeText });
    if (!result || typeof result !== "object" || typeof result.atsScore !== "number") {
      throw new AIServiceUnavailableError("malformed", "The AI returned an unreadable resume analysis.");
    }
    return {
      atsScore: result.atsScore,
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      missingSkills: Array.isArray(result.missingSkills) ? result.missingSkills : [],
      formattingFeedback: typeof result.formattingFeedback === "string" ? result.formattingFeedback : "",
      improvementSuggestions: Array.isArray(result.improvementSuggestions) ? result.improvementSuggestions : [],
    };
  }

  public static async getChatbotResponse(
    message: string,
    history: { role: "user" | "model"; text: string }[],
    profileContext: unknown
  ): Promise<string> {
    const result = await this.postRequest("chatbot", { message, history, profileContext });
    if (typeof result !== "string" || result.trim().length === 0) {
      throw new AIServiceUnavailableError("malformed", "The AI returned an empty response.");
    }
    return result;
  }

  /**
   * Multi-file career chat. Posts an optional set of attachments together with
   * the message; the server extracts readable text from each and answers in
   * markdown. Returns the model's reply.
   */
  public static async chatWithFiles(
    message: string,
    history: { role: "user" | "model"; text: string }[],
    profileContext: unknown,
    files: File[] = [],
    options?: { mode?: "advisor" | "interview"; targetJobDescription?: string }
  ): Promise<{ reply: string; files: { name: string; kind: "doc" | "image" }[] }> {
    let response: Response;
    try {
      const formData = new FormData();
      formData.append("message", message);
      formData.append("history", JSON.stringify(history));
      formData.append("profileContext", JSON.stringify(profileContext ?? {}));
      if (options?.mode) {
        formData.append("mode", options.mode);
      }
      if (options?.targetJobDescription) {
        formData.append("targetJobDescription", options.targetJobDescription);
      }
      for (const file of files) {
        formData.append("files", file, file.name);
      }
      response = await authedFetch("/api/chat", { method: "POST", body: formData });
    } catch (e) {
      console.error("AI Client network error for chat:", e);
      throw new AIServiceUnavailableError("network", "Could not reach the AI service. Check your connection.");
    }

    if (!response.ok) {
      let message = `The AI service returned ${response.status}.`;
      try {
        const errData = await response.json();
        if (errData && typeof errData.error === "string" && errData.error.length > 0) {
          message = errData.error;
        }
      } catch {
        // non-JSON error body; keep the status-derived message
      }
      if (response.status === 401) {
        throw new AIServiceUnavailableError("unauthenticated", "Please sign in to use AI features.");
      }
      if (response.status === 429) {
        throw new AIServiceUnavailableError("rate_limited", "Too many AI requests. Wait a moment and try again.");
      }
      throw new AIServiceUnavailableError("provider", message);
    }

    const body = await response.json();
    if (typeof body?.reply !== "string" || body.reply.trim().length === 0) {
      throw new AIServiceUnavailableError("malformed", "The AI returned an empty response.");
    }
    return {
      reply: body.reply,
      files: Array.isArray(body.files) ? body.files : [],
    };
  }



  /**
   * Full-person performance assessment. Sends the wallet documents, saved
   * opportunities and profile the client has loaded from Firestore; the server
   * turns them into an evidence-backed profile of the student.
   */
  public static async analyzePerformance(context: {
    profile: unknown;
    walletDocuments: unknown[];
    savedOpportunities: unknown[];
    enrichment?: ProfileEnrichment | null;
  }): Promise<PerformanceAssessment> {
    let response: Response;
    try {
      response = await authedFetch("/api/performance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
    } catch (e) {
      console.error("AI Client network error for performance analysis:", e);
      throw new AIServiceUnavailableError("network", "Could not reach the AI service. Check your connection.");
    }

    if (!response.ok) {
      let message = `The AI service returned ${response.status}.`;
      try {
        const errData = await response.json();
        if (errData && typeof errData.error === "string" && errData.error.length > 0) {
          message = errData.error;
        }
      } catch {
        // non-JSON error body; keep the status-derived message
      }
      if (response.status === 401) {
        throw new AIServiceUnavailableError("unauthenticated", "Please sign in to use AI features.");
      }
      if (response.status === 429) {
        throw new AIServiceUnavailableError("rate_limited", "Too many requests. Wait a moment and try again.");
      }
      throw new AIServiceUnavailableError("provider", message);
    }

    const body = await response.json();
    if (!body?.assessment || typeof body.assessment !== "object") {
      throw new AIServiceUnavailableError("malformed", "The AI returned an unreadable assessment.");
    }
    return body.assessment as PerformanceAssessment;
  }

  /**
   * Generates a dynamic, structured learning roadmap for any specified career role.
   */
  public static async generateRoadmap(role: string): Promise<any> {
    const raw = await this.postRequest("generateRoadmap", { role });
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new AIServiceUnavailableError("malformed", "Failed to parse roadmap structure from AI.");
    }
  }

  /**
   * Visits the student's saved links (GitHub + coding platforms) and returns
   * factual enrichment (repos, stars, commits, platform stats) plus improved
   * platform labels to write back onto the link documents.
   */
  public static async enrichProfile(
    links: { url: string; kind?: string; id?: string }[]
  ): Promise<{ enrichment: ProfileEnrichment; labels: { url: string; kind: string; platform: string; label: string }[] }> {
    let response: Response;
    try {
      response = await authedFetch("/api/profile/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
    } catch (e) {
      console.error("AI Client network error for profile enrichment:", e);
      throw new AIServiceUnavailableError("network", "Could not reach the enrichment service. Check your connection.");
    }

    if (!response.ok) {
      let message = `The enrichment service returned ${response.status}.`;
      try {
        const errData = await response.json();
        if (errData && typeof errData.error === "string" && errData.error.length > 0) {
          message = errData.error;
        }
      } catch {
        // non-JSON error body; keep the status-derived message
      }
      if (response.status === 401) {
        throw new AIServiceUnavailableError("unauthenticated", "Please sign in to use AI features.");
      }
      if (response.status === 429) {
        throw new AIServiceUnavailableError("rate_limited", "Too many enrichment requests. Wait a moment and try again.");
      }
      throw new AIServiceUnavailableError("provider", message);
    }

    const body = await response.json();
    if (!body?.enrichment || typeof body.enrichment !== "object") {
      throw new AIServiceUnavailableError("malformed", "The enrichment service returned an unreadable response.");
    }
    return {
      enrichment: body.enrichment as ProfileEnrichment,
      labels: Array.isArray(body.labels) ? body.labels : [],
    };
  }

  /**
   * Qualitative role-fit analysis for the opportunities the student has saved.
   * Returns, per saved opportunity, plus points drawn from their real profile and
   * gaps/actions to improve their odds. No scores.
   */
  public static async analyzeSavedOpportunities(context: {
    profile: unknown;
    walletDocuments: unknown[];
    savedOpportunities: unknown[];
    enrichment?: ProfileEnrichment | null;
  }): Promise<SavedOpportunityMatch[]> {
    let response: Response;
    try {
      response = await authedFetch("/api/opportunities/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
    } catch (e) {
      console.error("AI Client network error for saved-opportunity matching:", e);
      throw new AIServiceUnavailableError("network", "Could not reach the AI service. Check your connection.");
    }

    if (!response.ok) {
      let message = `The AI service returned ${response.status}.`;
      try {
        const errData = await response.json();
        if (errData && typeof errData.error === "string" && errData.error.length > 0) {
          message = errData.error;
        }
      } catch {
        // non-JSON error body; keep the status-derived message
      }
      if (response.status === 401) {
        throw new AIServiceUnavailableError("unauthenticated", "Please sign in to use AI features.");
      }
      if (response.status === 429) {
        throw new AIServiceUnavailableError("rate_limited", "Too many requests. Wait a moment and try again.");
      }
      throw new AIServiceUnavailableError("provider", message);
    }

    const body = await response.json();
    if (!Array.isArray(body?.matches)) {
      throw new AIServiceUnavailableError("malformed", "The AI returned an unreadable match analysis.");
    }
    return body.matches as SavedOpportunityMatch[];
  }

  public static async trackConfidence(scores: unknown): Promise<string> {
    const result = await this.postRequest("trackConfidence", { scores });
    if (typeof result !== "string" || result.trim().length === 0) {
      throw new AIServiceUnavailableError("malformed", "The AI returned an empty progress summary.");
    }
    return result;
  }
}