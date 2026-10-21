"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { googleCompleteSchema } from "@/lib/schemas";
import { useAuth } from "@/context/AuthContext";
import { User, Lock, AtSign, ArrowRight, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { z } from "zod";

type CompleteInputs = z.infer<typeof googleCompleteSchema>;

export default function CompleteProfile() {
  const { currentUser, profile, completeGoogleProfile, logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CompleteInputs>({
    resolver: zodResolver(googleCompleteSchema),
    defaultValues: {
      username: "",
      name: profile?.name || currentUser?.displayName || "",
      password: "",
      confirmPassword: "",
    },
  });

  const usernameWatch = watch("username");

  useEffect(() => {
    if (profile?.name && !watch("name")) setValue("name", profile.name);
    if (currentUser?.displayName && !watch("name")) setValue("name", currentUser.displayName);
  }, [profile, currentUser]);

  // If user not logged in via Google, redirect to signup
  useEffect(() => {
    if (!currentUser) {
      // give auth a moment
      const t = setTimeout(() => {
        if (!currentUser) router.replace("/auth/signup");
      }, 1200);
      return () => clearTimeout(t);
    }
    // If profile already has username, they're done
    if (profile?.username && profile.username.trim() !== "") {
      router.replace("/dashboard");
    }
  }, [currentUser, profile]);

  // Live username availability debounce (client-side check hint only; server is source of truth)
  useEffect(() => {
    const v = usernameWatch?.trim().toLowerCase();
    if (!v || v.length < 3) {
      setAvailable(null);
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(v)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username-check?u=${encodeURIComponent(v)}`);
        if (res.ok) {
          const j = await res.json();
          setAvailable(j.available);
        } else {
          setAvailable(null);
        }
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [usernameWatch]);

  const onSubmit = async (data: CompleteInputs) => {
    setError("");
    setLoading(true);
    try {
      await completeGoogleProfile(data.username.trim().toLowerCase(), data.name.trim(), data.password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.toLowerCase().includes("username already taken")) setError("That username is already taken. Try another.");
      else if (msg.includes("weak-password")) setError("Password is too weak. Use at least 6 characters.");
      else if (msg.includes("requires-recent-login")) setError(msg);
      else setError(msg || "Failed to complete profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-48 h-48 bg-primary/20 rounded-full filter blur-3xl opacity-50" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-primary/10 rounded-full filter blur-3xl opacity-50" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground mb-6">
          <span className="p-1.5 bg-gradient-to-tr from-primary to-secondary text-white rounded-xl shadow-md">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="font-extrabold tracking-wider">NEXORA</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-foreground">Complete your profile</h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          You signed in with Google. Choose a unique username, confirm your name and set a password so you can also login with username.
        </p>
        {currentUser.email && <p className="mt-1 text-center text-xs text-foreground-muted">Google email: <span className="font-semibold text-foreground">{currentUser.email}</span></p>}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-surface py-8 px-4 shadow-xl border border-border sm:rounded-3xl sm:px-10">
          {error && <div className="mb-4 text-sm bg-danger-surface text-danger p-3.5 rounded-xl border border-border">{error}</div>}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Unique Username *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><AtSign className="w-4 h-4" /></span>
                <input
                  type="text"
                  placeholder="e.g. nikhil_2026"
                  {...register("username")}
                  onChange={(e) => {
                    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    register("username").onChange(e);
                  }}
                  className={`w-full text-sm pl-10 pr-10 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.username ? "border-danger" : "border-border"}`}
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs">
                  {checking && <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground-muted" />}
                  {!checking && available === true && <span className="text-emerald-600 font-bold">✓</span>}
                  {!checking && available === false && <span className="text-danger font-bold">✗</span>}
                </span>
              </div>
              {available === false && <p className="mt-1 text-xs text-danger">Username already taken</p>}
              {available === true && <p className="mt-1 text-xs text-emerald-600">Username available</p>}
              {errors.username && <p className="mt-1 text-xs text-danger">{errors.username.message}</p>}
              <p className="mt-1 text-[11px] text-foreground-muted">3–20 chars, lowercase letters, numbers, underscore only.</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Full Name *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><User className="w-4 h-4" /></span>
                <input
                  type="text"
                  placeholder="Your Name"
                  {...register("name")}
                  className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.name ? "border-danger" : "border-border"}`}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Create Password *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><Lock className="w-4 h-4" /></span>
                <input type="password" placeholder="••••••••" {...register("password")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.password ? "border-danger" : "border-border"}`} />
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
              <p className="mt-1 text-[11px] flex items-center gap-1 text-foreground-muted"><ShieldCheck className="w-3 h-3" /> This lets you also login with username + password alongside Google.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Confirm Password *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><Lock className="w-4 h-4" /></span>
                <input type="password" placeholder="••••••••" {...register("confirmPassword")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.confirmPassword ? "border-danger" : "border-border"}`} />
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
            </button>

            <button type="button" onClick={handleLogout} className="w-full text-xs font-semibold text-foreground-muted hover:text-foreground py-2">Use different account</button>
          </form>
        </div>
      </div>
    </div>
  );
}
