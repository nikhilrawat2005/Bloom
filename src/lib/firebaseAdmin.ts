// Firebase Admin initializer — used by server-only routes that need to read or
// write Firestore / verify ID tokens without going through client-side security
// rules. The Admin SDK bypasses `firestore.rules` entirely, so every caller is
// responsible for its own authorization check (see `src/lib/serverAuth.ts`).
//
// Credential resolution order:
// 1. FIREBASE_SERVICE_ACCOUNT_KEY env var — a single-line JSON string of the
//    full service account key. This is what you set in Vercel's dashboard.
// 2. scripts/serviceAccountKey.json on disk — local dev convenience. Never
//    committed (see .gitignore). Never place a key inside `public/`, which
//    Next.js copies verbatim into the build output and serves unauthenticated.

import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadCredential(): Record<string, unknown> {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    raw = raw.trim();
    // Try raw JSON first
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key && typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch {
      // Fallback: try base64 decode if env var was base64 encoded
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.private_key && typeof parsed.private_key === "string") {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }
        return parsed;
      } catch {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON or base64 JSON."
        );
      }
    }
  }

  const localPath = join(process.cwd(), "scripts", "serviceAccountKey.json");
  if (existsSync(localPath)) {
    return JSON.parse(readFileSync(localPath, "utf-8"));
  }

  throw new Error(
    "No Firebase service account credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY in your environment (production), or place scripts/serviceAccountKey.json locally (dev)."
  );
}

// `getApps().length === 0` is a TOCTOU check: two concurrent invocations in the
// same instance can both observe an empty registry and both call
// initializeApp(), and the loser throws "Firebase app named '[DEFAULT]' already
// exists". Memoize the App instead so initialization happens exactly once.
let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
  } else {
    cachedApp = initializeApp({
      credential: cert(loadCredential()),
      ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
    });
  }
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getAdminApp());
    try {
      cachedDb.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings may already be frozen
    }
  }
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/** True when Admin SDK credentials are usable. Used to degrade gracefully in local dev. */
export function hasAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return true;
  return existsSync(join(process.cwd(), "scripts", "serviceAccountKey.json"));
}