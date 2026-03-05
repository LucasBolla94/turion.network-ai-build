"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function DomainsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(getUser());

  useEffect(() => {
    auth.me().then(setUser).catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <DashboardSidebar user={user} />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Domains</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Connect custom domains to your apps</p>
        </div>

        {/* Subdomain info */}
        <div className="bg-[var(--brand)]/10 border border-[var(--brand)]/30 rounded-2xl p-5 mb-6 flex items-start gap-4">
          <span className="text-2xl mt-0.5">🌐</span>
          <div>
            <div className="text-white font-medium text-sm mb-1">Your apps get a free subdomain automatically</div>
            <div className="text-[var(--muted)] text-sm">
              Every app you deploy gets <code className="bg-[var(--background)] px-1.5 py-0.5 rounded text-[var(--brand)] text-xs">your-app.turion.network</code> instantly — no setup needed.
            </div>
          </div>
        </div>

        <div className="max-w-2xl">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">🌐</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-[var(--brand)]/10 border border-[var(--brand)]/30 text-[var(--brand)] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
              Coming soon
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Custom Domains</h2>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-md mx-auto leading-relaxed">
              Connect your own domain (e.g. <span className="text-white">myapp.com</span>) to any app. We handle SSL certificates, DNS verification, and routing automatically.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Custom domain (yourdomain.com)", "Auto SSL via Let's Encrypt", "DNS verification", "www redirect", "Pro & Team plans"].map(f => (
                <span key={f} className="bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] text-xs px-3 py-1.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
