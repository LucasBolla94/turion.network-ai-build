"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.register({ name, email, password });
      saveSession(res.access_token, res.user);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 409 ? "This email is already registered." : err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="w-12 h-12 rounded-xl bg-[var(--brand)] flex items-center justify-center mx-auto mb-4 cursor-pointer hover:opacity-90 transition-opacity">
              <span className="text-white font-bold text-xl">T</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create free account</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--brand)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-red-400 text-xs mt-1">{8 - password.length} more characters needed</p>
              )}
              {password.length >= 8 && (
                <p className="text-green-400 text-xs mt-1">✓ Good password</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create free account"
              )}
            </button>

            <p className="text-xs text-[var(--muted)] text-center">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="text-[var(--brand)] hover:underline">
                Terms of Service
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
