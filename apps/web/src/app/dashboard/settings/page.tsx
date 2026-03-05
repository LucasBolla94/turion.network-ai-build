"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, getToken, clearSession, saveSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser]       = useState<UserPublic | null>(getUser());
  const [locale, setLocale]   = useState("en");
  const [currency, setCurrency] = useState<"GBP" | "BRL">("GBP");
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    auth.me().then(u => {
      setUser(u);
      setLocale(u.locale ?? "en");
      setCurrency(u.currency ?? "GBP");
    }).catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  async function handleSave() {
    const token = getToken();
    if (!token || !user) return;
    try {
      const res = await fetch("/api-backend/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale, currency }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        saveSession(token, updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <DashboardSidebar user={user} />

      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Manage your account preferences</p>
        </div>

        <div className="max-w-xl space-y-6">
          {/* Profile card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">Full name</label>
                <input
                  value={user?.name ?? ""}
                  readOnly
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--muted)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">Email</label>
                <input
                  value={user?.email ?? ""}
                  readOnly
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--muted)] cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Preferences card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">Preferences</h2>
            <div className="space-y-5">
              {/* Language */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">Language</label>
                <select
                  value={locale}
                  onChange={e => setLocale(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--brand)] transition-colors"
                >
                  <option value="en">English</option>
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">Currency</label>
                <div className="flex gap-3">
                  {(["GBP", "BRL"] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        currency === c
                          ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                          : "bg-[var(--background)] border-[var(--border)] text-[var(--muted)] hover:text-white"
                      }`}>
                      {c === "GBP" ? "£ GBP" : "R$ BRL"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button onClick={handleSave}
                className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Save changes
              </button>
              {saved && <span className="text-green-400 text-sm">Saved!</span>}
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-[var(--surface)] border border-red-500/20 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h2>
            <p className="text-xs text-[var(--muted)] mb-4">
              Permanently delete your account and all data. This cannot be undone.
            </p>
            <button
              onClick={() => alert("Please contact support@turion.network to delete your account.")}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
              Delete account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
