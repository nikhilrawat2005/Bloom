// Browser-side helper for calling authenticated API routes.
//
// Firebase ID tokens expire after ~1 hour, so always read a fresh token right
// before the request rather than caching one.

import { auth } from "@/lib/firebase";

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch (err) {
    console.warn("[apiClient] Could not read ID token:", (err as Error).message);
    return {};
  }
}

/**
 * `fetch` with the Firebase ID token attached.
 *
 * Throws on a non-2xx response so callers get one error path; the parsed body
 * is attached to the thrown error for routes that return a useful `error`
 * message. On 401 we force a token refresh once and retry, which covers the
 * common case of a request that started just before a token rotation.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {},
  opts: { retryOn401?: boolean } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeaders())) {
    headers.set(key, value);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && (opts.retryOn401 ?? true) && auth.currentUser) {
    try {
      const fresh = await auth.currentUser.getIdToken(true);
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Authorization", `Bearer ${fresh}`);
      return await fetch(input, { ...init, headers: retryHeaders });
    } catch {
      return res;
    }
  }

  return res;
}

/** `authedFetch` + JSON parsing + non-2xx rejection. */
export async function authedJson<T = unknown>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await authedFetch(input, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
        ? (body as { error: string }).error
        : `Request failed with status ${res.status}`;
    const error = new Error(message) as Error & { status?: number; body?: unknown };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body as T;
}