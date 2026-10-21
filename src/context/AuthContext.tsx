"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { authedFetch } from "@/lib/apiClient";

interface UserProfile {
  username: string;
  name: string;
  email: string;
  role?: "user" | "organization" | "admin";
  authProvider?: "password" | "google" | "google+password";
  bio?: string;
  education?: string;
  skills?: string[];
  interests?: string[];
  location?: string;
  category?: string;
  categories?: string[];
  income?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Canonical server-resolved role. Never derived from a client-side allow-list. */
  isAdmin: boolean;
  // email+username signup
  signup: (username: string, name: string, email: string, password: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  loginWithIdentifier: (identifier: string, password: string) => Promise<any>;
  loginWithGoogle: () => Promise<{ cred: any; needsCompletion: boolean }>;
  completeGoogleProfile: (username: string, name: string, password: string) => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  logout: () => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<any>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

async function usernameAvailable(username: string): Promise<boolean> {
  const key = normalizeUsername(username);
  try {
    const snap = await getDoc(doc(db, "usernames", key));
    return !snap.exists();
  } catch {
    // Read blocked (rules) or offline: assume available; real uniqueness
    // is enforced at claim time via Firestore rules on the usernames collection.
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleCheckedUid, setRoleCheckedUid] = useState<string | null>(null);

  /**
   * Ask the server what this user's role actually is.
   *
   * The role used to be computed in the browser from an allow-list that shipped
   * in the public bundle, and written with `updateDoc` - so anyone could read the
   * admin list and self-promote. The server now owns the decision.
   */
  async function resolveRoleFromServer(): Promise<boolean> {
    try {
      const res = await authedFetch("/api/admin/resolve-role", { method: "POST" });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.role === "admin";
    } catch (e) {
      console.error("Error resolving role:", e);
      return false;
    }
  }

  async function refreshProfile(uid?: string) {
    const activeUid = uid || currentUser?.uid;
    if (!activeUid) return;
    try {
      const [snap, isAdmin] = await Promise.all([
        getDoc(doc(db, "users", activeUid)),
        resolveRoleFromServer(),
      ]);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
      setRoleCheckedUid(isAdmin ? activeUid : null);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  async function checkUsernameAvailable(username: string) {
    return usernameAvailable(username);
  }

  async function signup(username: string, name: string, email: string, password: string) {
    const key = normalizeUsername(username);
    if (!(await usernameAvailable(username))) throw new Error("Username already taken");

    // Firebase normalises token emails to lowercase and the `usernames` rule
    // compares this value against the token, so store it in the same casing or
    // a user who typed "Nikhil@Gmail.com" would be denied their own claim.
    const normalizedEmail = email.trim().toLowerCase();

    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    await updateProfile(cred.user, { displayName: name });

    // Claim the username BEFORE writing the profile. If the claim is lost (another
    // signup won the race between our availability check and this write), rolling
    // back is a single auth-user delete; the old order left the profile advertising
    // a username owned by somebody else, which then could never be claimed again.
    try {
      await setDoc(doc(db, "usernames", key), {
        uid: cred.user.uid,
        username: key,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to claim username doc", e);
      try {
        await cred.user.delete();
      } catch (cleanupErr) {
        console.error("Failed to roll back incomplete signup", cleanupErr);
      }
      throw new Error(
        "That username was taken while you were signing up. Please pick another and try again."
      );
    }

    const initialProfile: UserProfile = {
      username: key,
      name,
      email: normalizedEmail,
      // Always start as "user". The server promotes to "admin" via
      // /api/admin/resolve-role; the client must not decide this.
      role: "user",
      authProvider: "password",
      bio: "",
      education: "",
      skills: [],
      interests: [],
      location: "",
      category: "",
      income: "",
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", cred.user.uid), initialProfile);
    setProfile(initialProfile);
    return cred;
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithIdentifier(identifier: string, password: string) {
    const raw = identifier.trim();
    // If looks like email, direct
    if (raw.includes("@")) {
      return signInWithEmailAndPassword(auth, raw, password);
    }
    // Otherwise treat as username: resolve to email via usernames collection
    const key = normalizeUsername(raw);
    const snap = await getDoc(doc(db, "usernames", key));
    if (!snap.exists()) {
      throw new Error("Username not found");
    }
    const data: any = snap.data();
    const email = data.email as string;
    if (!email) throw new Error("Username record missing email");
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle(): Promise<{ cred: any; needsCompletion: boolean }> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const uid = cred.user.uid;

    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      // No profile yet: must complete username/name/password
      const draft: any = {
        username: "",
        name: cred.user.displayName || "",
        email: cred.user.email || "",
        role: "user",
        authProvider: "google",
        bio: "",
        education: "",
        skills: [],
        interests: [],
        location: "",
        category: "",
        income: "",
        createdAt: new Date().toISOString(),
      };
      // Create a minimal placeholder so uid is reserved; username empty signals incomplete
      await setDoc(doc(db, "users", uid), draft);
      setProfile(draft);
      return { cred, needsCompletion: true };
    }

    const data = snap.data() as UserProfile;
    // If existing profile but username missing/empty: needs completion
    if (!data.username || data.username.trim() === "") {
      setProfile(data);
      return { cred, needsCompletion: true };
    }

    setProfile(data);
    return { cred, needsCompletion: false };
  }

  async function completeGoogleProfile(username: string, name: string, password: string) {
    if (!auth.currentUser) throw new Error("No authenticated user");
    const user = auth.currentUser;
    const key = normalizeUsername(username);
    if (!(await usernameAvailable(username))) throw new Error("Username already taken");

    // Link password so user can also login with username/password
    const email = user.email;
    if (!email) throw new Error("Google account has no email");
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
    } catch (e: any) {
      // If already linked (provider already exists) or other error, surface but don't block profile completion
      if (e.code === "auth/provider-already-linked" || e.code === "auth/credential-already-in-use") {
        // already linked - okay
      } else if (e.code === "auth/requires-recent-login") {
        throw new Error("Please re-login with Google and try again (recent login required to set password).");
      } else {
        // If linking fails for other reason, still allow profile completion but log
        console.warn("Password linking failed:", e);
        // Optionally fall back to just setting profile without linking - user can still login via Google
        // But per requirement, we want password set; rethrow to let user retry with different password
        if (e.code !== "auth/weak-password") throw e;
        else throw e;
      }
    }

    await updateProfile(user, { displayName: name });

    const uid = user.uid;

    // Same ordering rule as `signup`: claim the name before the profile points
    // at it, and fail loudly instead of silently leaving a dangling username.
    // No auth-user rollback here — the Google account already existed.
    try {
      await setDoc(doc(db, "usernames", key), {
        uid,
        username: key,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to claim username doc", e);
      throw new Error(
        "That username was taken while you were completing your profile. Please pick another."
      );
    }

    const snap = await getDoc(doc(db, "users", uid));
    const existing = snap.exists() ? (snap.data() as any) : {};
    const updated: UserProfile = {
      username: key,
      name,
      email: normalizedEmail,
      role: typeof existing.role === "string" ? existing.role : "user",
      authProvider: "google+password",
      bio: existing.bio || "",
      education: existing.education || "",
      skills: existing.skills || [],
      interests: existing.interests || [],
      location: existing.location || "",
      category: existing.category || "",
      income: existing.income || "",
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", uid), updated, { merge: true });
    setProfile(updated);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }

  async function updateUserProfile(data: Partial<UserProfile>) {
    if (!currentUser) throw new Error("No authenticated user");
    // If username is being changed, need uniqueness handling (not exposed in UI yet)
    if (data.username) {
      const key = normalizeUsername(data.username);
      if (key !== profile?.username) {
        if (!(await usernameAvailable(data.username))) throw new Error("Username already taken");
        // The claim must carry the token's own lowercase email or the
        // `usernames` rule rejects it and the rename silently half-applies.
        const claimEmail = (profile?.email || currentUser.email || "").trim().toLowerCase();
        await setDoc(doc(db, "usernames", key), {
          uid: currentUser.uid,
          username: key,
          email: claimEmail,
          createdAt: new Date().toISOString(),
        });
        // Release the previous name so it is not stranded; rules allow the owner
        // to delete their own claim.
        const previous = profile?.username;
        if (previous && normalizeUsername(previous) !== key) {
          try {
            await deleteDoc(doc(db, "usernames", normalizeUsername(previous)));
          } catch (e) {
            console.warn("Failed to release previous username claim", e);
          }
        }
        data.username = key;
      }
    }
    await updateDoc(doc(db, "users", currentUser.uid), { ...data, updatedAt: new Date().toISOString() });
    await refreshProfile(currentUser.uid);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await refreshProfile(user.uid);
      } else {
        setProfile(null);
        setRoleCheckedUid(null);
      }
      setLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const value = {
    currentUser,
    profile,
    loading,
    isAdmin: roleCheckedUid !== null && roleCheckedUid === currentUser?.uid,
    signup,
    login,
    loginWithIdentifier,
    loginWithGoogle,
    completeGoogleProfile,
    checkUsernameAvailable,
    logout,
    resetPassword,
    updateUserProfile,
    refreshProfile,
  };

  // `children` used to be withheld until auth resolved, which blanked every
  // public page (landing, explore, login) on first paint. Consumers that need to
  // wait should read `loading` themselves.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
