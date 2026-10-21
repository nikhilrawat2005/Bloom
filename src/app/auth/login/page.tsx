"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/schemas";
import { useAuth } from "@/context/AuthContext";
import { AtSign, Lock, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
  const { loginWithIdentifier, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setError("");
    setLoading(true);
    try {
      await loginWithIdentifier(data.identifier.trim(), data.password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("Username not found")) setError("Username not found. Check spelling or try your email.");
      else if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) setError("Invalid identifier or password. Please try again.");
      else setError(msg || "That identifier and password do not match. Please try again.");
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
          <span className="p-1.5 bg-gradient-to-tr from-primary to-secondary text-white rounded-xl shadow-md shadow-primary/20"><Sparkles className="w-5 h-5" /></span>
          <span className="font-extrabold tracking-wider bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">NEXORA</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-foreground">Welcome back</h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">Sign in with your <span className="font-semibold">email or username</span> + password, or Google.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-surface py-8 px-4 shadow-xl border border-border sm:rounded-3xl sm:px-10 transition-colors duration-300">
          {error && <div className="mb-4 text-sm bg-danger-surface text-danger p-3.5 rounded-xl border border-border">{error}</div>}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Identifier */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Email or Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><AtSign className="w-4 h-4" /></span>
                <input type="text" placeholder="name@example.com or nikhil_2026" {...register("identifier")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.identifier ? "border-danger focus:border-danger" : "border-border"}`} />
              </div>
              {errors.identifier && <p className="mt-1 text-xs text-danger">{errors.identifier.message}</p>}
              <p className="mt-1 text-[11px] text-foreground-muted">Google users who set a password can login here with their username too.</p>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted">Password</label>
                <Link href="/auth/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground-muted"><Lock className="w-4 h-4" /></span>
                <input type="password" placeholder="••••••••" {...register("password")} className={`w-full text-sm pl-10 pr-4 py-3 bg-surface-raised border rounded-2xl outline-none focus:bg-surface focus:border-primary text-foreground placeholder-foreground-muted transition-all ${errors.password ? "border-danger focus:border-danger" : "border-border"}`} />
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading || googleLoading} className="w-full mt-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold text-foreground-muted">
              <span className="bg-surface px-3 relative z-10">Or continue with</span>
              <div className="absolute inset-y-1/2 left-0 right-0 border-t border-border"></div>
            </div>
            <button onClick={handleGoogleSignIn} disabled={loading || googleLoading} className="w-full mt-4 bg-surface hover:bg-surface-raised text-foreground border border-border font-semibold text-sm py-3 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24"><path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.18 4.114-3.414 0-6.182-2.768-6.182-6.182S10.534 6.15 13.948 6.15c1.558 0 2.97.587 4.043 1.546l3.056-3.056C19.16 2.822 16.73 1.8 13.948 1.8c-5.753 0-10.422 4.67-10.422 10.422s4.67 10.422 10.422 10.422c6.046 0 10.05-4.249 10.05-10.222 0-.665-.06-1.3-.178-1.937H12.24Z" /></svg>
                Sign in with Google
              </>}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-foreground-muted">New to NEXORA? <Link href="/auth/signup" className="font-bold text-primary hover:text-primary-hover transition-colors">Create an account</Link></div>
        </div>
      </div>
    </div>
  );
}
