import type { WalletCategory } from "@/lib/types";

export const WALLET_CATEGORIES: WalletCategory[] = [
  "Resume",
  "Certificates",
  "Awards",
  "Projects",
  "Results",
  "ID Documents",
  "Other",
];

const ALIASES: Record<string, WalletCategory> = {
  resume: "Resume",
  cv: "Resume",
  "curriculum vitae": "Resume",
  certificates: "Certificates",
  certificate: "Certificates",
  certifications: "Certificates",
  awards: "Awards",
  award: "Awards",
  achievements: "Awards",
  honours: "Awards",
  honors: "Awards",
  projects: "Projects",
  project: "Projects",
  "project report": "Projects",
  results: "Results",
  result: "Results",
  marksheets: "Results",
  marksheet: "Results",
  "mark sheet": "Results",
  transcripts: "Results",
  transcript: "Results",
  "academic records": "Results",
  scores: "Results",
  "id documents": "ID Documents",
  "id document": "ID Documents",
  identity: "ID Documents",
  "identity proof": "ID Documents",
  "identity documents": "ID Documents",
  kyc: "ID Documents",
  other: "Other",
  unknown: "Other",
  uncategorized: "Other",
  miscellaneous: "Other",
};

export function isWalletCategory(value: unknown): value is WalletCategory {
  return typeof value === "string" && (WALLET_CATEGORIES as string[]).includes(value);
}

/** Loosely map a free-form model/user string to a real category. */
export function normalizeCategory(value: unknown): WalletCategory | null {
  if (isWalletCategory(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/[._-]+/g, " ");
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  const compact = cleaned.replace(/\s+/g, " ");
  if (ALIASES[compact]) return ALIASES[compact];
  if (compact.includes("id") && compact.includes("document")) return "ID Documents";
  if (compact.includes("mark") || compact.includes("grade") || compact.includes("score")) {
    return "Results";
  }
  if (compact.includes("certif")) return "Certificates";
  if (compact.includes("award") || compact.includes("prize") || compact.includes("medal")) {
    return "Awards";
  }
  if (compact.includes("project")) return "Projects";
  if (compact.includes("resume") || compact.includes("curriculum")) return "Resume";
  return null;
}
