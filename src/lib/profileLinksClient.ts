/**
 * Public profile links live in users/{uid}/profileLinks — one document per URL.
 * Kept out of the `wallet` collection on purpose: a link is not a document, and
 * mixing them in would pollute the category histogram and the evidence score.
 */
import { db } from "./firebase";
import { collection, addDoc, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import type { ProfileLink } from "./types";
import { isSameLink, kindLabel, parseProfileLink } from "./profileLinks";

const linksRef = (uid: string) => collection(db, "users", uid, "profileLinks");

export function subscribeProfileLinks(
  uid: string,
  onChange: (links: ProfileLink[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(linksRef(uid), orderBy("addedAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const links: ProfileLink[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<ProfileLink> & { addedAt?: unknown };
        const url = typeof data.url === "string" ? data.url.trim() : "";
        if (!url) return;
        const parsed = parseProfileLink(url);
        links.push({
          id: d.id,
          url: parsed.ok ? parsed.url : url,
          kind: data.kind || parsed.kind || "other",
          label: (typeof data.label === "string" && data.label.trim()) || kindLabel(data.kind || parsed.kind || "other"),
          addedAt: typeof data.addedAt === "string" ? data.addedAt : undefined,
          origin: data.origin === "document" ? "document" : "manual",
        });
      });
      onChange(links);
    },
    (error) => onError?.(error)
  );
}

export type AddLinkResult = { ok: true; id: string } | { ok: false; error: string };

export async function addProfileLink(
  uid: string,
  url: string,
  options: { label?: string; origin?: "manual" | "document" } = {}
): Promise<AddLinkResult> {
  const parsed = parseProfileLink(url);
  if (!parsed.ok) return { ok: false, error: parsed.error || "That link could not be saved." };

  const existing = await hasLink(uid, parsed.url);
  if (existing) return { ok: false, error: "That link is already saved." };

  const ref = await addDoc(linksRef(uid), {
    uid,
    url: parsed.url,
    kind: parsed.kind,
    label: options.label?.trim() || parsed.label,
    origin: options.origin || "manual",
    addedAt: serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

/** Links the user has already saved, used to block duplicates and offer imports. */
export async function listProfileLinks(uid: string): Promise<ProfileLink[]> {
  try {
    const snap = await getDocs(linksRef(uid));
    return snap.docs
      .map((d) => {
        const data = d.data() as Partial<ProfileLink> & { addedAt?: unknown };
        return {
          id: d.id,
          url: typeof data.url === "string" ? data.url : "",
          kind: data.kind || "other",
          label: typeof data.label === "string" ? data.label : undefined,
          addedAt: typeof data.addedAt === "string" ? data.addedAt : undefined,
          origin: data.origin === "document" ? "document" : "manual",
        } as ProfileLink;
      })
      .filter((l) => l.url);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[profile-links] list failed:", msg);
    throw err;
  }
}

async function hasLink(uid: string, url: string): Promise<boolean> {
  const existing = await listProfileLinks(uid);
  return existing.some((l) => isSameLink(l.url, url));
}

export async function removeProfileLink(uid: string, linkId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "profileLinks", linkId));
}
