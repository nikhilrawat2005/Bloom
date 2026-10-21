import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The ingestion layer and AI providers deliberately work with untyped
  // external payloads (Cheerio DOM, third-party JSON APIs, Firestore docs).
  // `any` is intentional there; keep the rule active as a warning only.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // Advisory perf rule — most flagged patterns are one-shot data fetches
      // on mount; keeping as a warning avoids masking real issues.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // backend/ is a standalone CommonJS Node server (not deployed to Vercel).
  {
    files: ["backend/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
