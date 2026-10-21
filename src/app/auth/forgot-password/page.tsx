"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Mail, ArrowLeft, Loader2, Sparkles, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to send reset link. Check the email address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-primary/10 rounded-full filter blur-3xl opacity-50"></div>
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-secondary/10 rounded-full filter blur-3xl opacity-50"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground mb-6">
          <span className="p-1.5 bg-gradient-to-tr from-primary to-secondary text-white rounded-xl shadow-md shadow-primary/20">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="font-extrabold tracking-wider bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">NEXORA</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-foreground">Reset Password</h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          We&apos;ll send you an email with instructions to set a new password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-3xl sm:px-10">
          {error && (
            <div className="mb-4 text-sm bg-red-50 text-red-500 p-3.5 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center text-green-500">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Check your inbox</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                If an account exists for <span className="font-semibold">{email}</span>, we have sent instructions to reset your password.
              </p>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary hover:bg-primary/25 text-white font-semibold text-sm py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <div className="text-center pt-4 border-t border-slate-100">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
