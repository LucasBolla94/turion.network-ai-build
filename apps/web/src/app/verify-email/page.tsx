"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }
    fetch(`/api-backend/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const d = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(d.message ?? "Email verified!");
        } else {
          setStatus("error");
          setMessage(d.detail ?? "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand)] flex items-center justify-center">
            <span className="text-white font-bold text-base">T</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          {status === "loading" && (
            <>
              <span className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--brand)] rounded-full animate-spin inline-block mb-4" />
              <p className="text-[var(--muted)] text-sm">Verifying your email…</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-white font-bold text-lg mb-2">Email verified!</h2>
              <p className="text-[var(--muted)] text-sm mb-6">{message}</p>
              <Link href="/dashboard"
                className="inline-block bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Go to Dashboard →
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-white font-bold text-lg mb-2">Verification failed</h2>
              <p className="text-[var(--muted)] text-sm mb-6">{message}</p>
              <Link href="/dashboard"
                className="text-[var(--brand)] text-sm hover:underline">
                Back to Dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
