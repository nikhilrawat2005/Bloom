"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@/lib/schemas";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, User, AtSign, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";

type SignupFormInputs = z.infer<typeof signupSchema>;

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
  });

  const usernameWatch = watch("username");

  // Live username check
  useEffect(() => {
    const v = usernameWatch?.trim().toLowerCase();
    if (!v || v.length < 3 || !/^[a-z0-9_]{3,20}$/.test(v)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username-check?u=${encodeURIComponent(v)}`);
        const j = await res.json();
        setAvailable(res.ok ? j.available : null);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [usernameWatch]);

  const onSubmit = async (data: SignupFormInputs) => {
    setError("");
    setLoading(true);
    try {
      await signup(data.username.trim().toLowerCase(), data.name.trim(), data.email.trim(), data.password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("Username already taken")) setError("That username is already taken. Try another.");
      else if (err.code === "auth/email-already-in-use") setError("An account already exists with this email.");
      else if (err.code === "auth/weak-password") setError("Password is too weak.");
      else setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { needsCompletion } = await loginWithGoogle();
      if (needsCompletion) router.push("/auth/complete-profile");
      else router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Google Sign-In failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-10 left-10 w-48 h-48 bg-primary/20 dark:bg-primary/10 rounded-full filter blur-3xl opacity-50"></div>
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-primary/10 dark:bg-[rgba(255,60,110,0.08)] rounded-full filter blur-3xl opacity-50"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground mb-6">
          <span className="p-1.5 bg-gradient-to-tr from-primary to-secondary text-white rounded-xl shadow-md shadow-primary/20">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="font-extrabold tracking-wider bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">NEXORA</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-foreground">Create your account</h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">Two ways: Email + password, or Google → then pick username & password. Every user gets a unique username.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-surface py-8 px-4 shadow-xl border border-border sm:rounded-3xl sm:px-10 transition-colors duration-300">
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
                  className={`w-full text-sm pl-10 pr-10 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.username ? "border-danger focus:border-danger" : "border-border"}`}
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
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Full Name *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><User className="w-4 h-4" /></span>
                <input type="text" placeholder="Your Name" {...register("name")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.name ? "border-danger focus:border-danger" : "border-border"}`} />
              </div>
              {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Email Address *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><Mail className="w-4 h-4" /></span>
                <input type="email" placeholder="name@example.com" {...register("email")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.email ? "border-danger focus:border-danger" : "border-border"}`} />
              </div>
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Password *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><Lock className="w-4 h-4" /></span>
                <input type="password" placeholder="••••••••" {...register("password")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.password ? "border-danger focus:border-danger" : "border-border"}`} />
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading || googleLoading} className="w-full mt-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold text-foreground-muted">
              <span className="bg-surface px-3 relative z-10">Or sign up with</span>
              <div className="absolute inset-y-1/2 left-0 right-0 border-t border-border"></div>
            </div>
            <button onClick={handleGoogleSignIn} disabled={loading || googleLoading} className="w-full mt-4 bg-surface hover:bg-surface-raised text-foreground border border-border font-semibold text-sm py-3 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24"><path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.18 4.114-3.414 0-6.182-2.768-6.182-6.182S10.534 6.15 13.948 6.15c1.558 0 2.97.587 4.043 1.546l3.056-3.056C19.16 2.822 16.73 1.8 13.948 1.8c-5.753 0-10.422 4.67-10.422 10.422s4.67 10.422 10.422 10.422c6.046 0 10.05-4.249 10.05-10.222 0-.665-.06-1.3-.178-1.937H12.24Z" /></svg>
                Sign up with Google — then set username & password
              </>}
            </button>
            <p className="mt-2 text-[11px] text-center text-foreground-muted">Google sign-up will ask for a username & password on the next step so you can also login with username.</p>
          </div>

          <p className="mt-6 text-center text-sm text-foreground-muted">Already have an account? <Link href="/auth/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
