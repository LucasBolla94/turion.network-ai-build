"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, appsApi, type UserPublic, type AppSummary } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Draft",    cls: "bg-gray-500/20 text-gray-400" },
  building: { label: "Building", cls: "bg-yellow-500/20 text-yellow-400" },
  online:   { label: "Online",   cls: "bg-green-500/20 text-green-400" },
  stopped:  { label: "Stopped",  cls: "bg-red-500/20 text-red-400" },
  error:    { label: "Error",    cls: "bg-red-500/20 text-red-400" },
};

export default function AppsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(getUser());
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    auth.me().then(setUser).catch(() => { clearSession(); router.replace("/login"); });
    appsApi.list().then(setApps).finally(() => setLoading(false));
  }, [router]);

  async function handleDeploy(app: AppSummary) {
    setActionId(app.id);
    try {
      const updated = await appsApi.deploy(app.id);
      setApps(prev => prev.map(a => a.id === app.id ? updated : a));
    } catch (e: unknown) {
      alert((e as Error).message ?? "Deploy failed");
    } finally {
      setActionId(null);
    }
  }

  async function handleStop(app: AppSummary) {
    setActionId(app.id);
    try {
      const updated = await appsApi.stop(app.id);
      setApps(prev => prev.map(a => a.id === app.id ? updated : a));
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(app: AppSummary) {
    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
    setActionId(app.id);
    try {
      await appsApi.delete(app.id);
      setApps(prev => prev.filter(a => a.id !== app.id));
      setUser(u => u ? { ...u, apps_count: Math.max(0, u.apps_count - 1) } : u);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <DashboardSidebar user={user} />

      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Apps</h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              {apps.length} app{apps.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/dashboard/builder"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            + Build new app
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-[var(--muted)]">
            <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand)] rounded-full animate-spin mr-3" />
            Loading apps…
          </div>
        ) : apps.length === 0 ? (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mb-5">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">No apps yet</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-sm">
              Use the AI Builder to describe your app — the AI generates the code. Then click &quot;Save as App&quot; to save and deploy it here.
            </p>
            <Link href="/dashboard/builder"
              className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors">
              Open AI Builder →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {apps.map(app => {
              const badge = STATUS_BADGE[app.status] ?? STATUS_BADGE.draft;
              const busy = actionId === app.id;
              return (
                <div key={app.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center shrink-0 text-2xl">
                    ⚡
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold truncate">{app.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[var(--muted)] text-xs font-mono mb-1">
                      /{app.slug} · {app.files_count} file{app.files_count !== 1 ? "s" : ""}
                    </p>
                    {app.preview_url && (
                      <a href={app.preview_url} target="_blank" rel="noreferrer"
                        className="text-xs text-[var(--brand)] hover:underline break-all">
                        {app.preview_url}
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {app.status === "online" ? (
                      <>
                        <a href={app.preview_url!} target="_blank" rel="noreferrer"
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-white hover:bg-[var(--background)] transition-colors">
                          Open ↗
                        </a>
                        <button onClick={() => handleStop(app)} disabled={busy}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          {busy ? "…" : "Stop"}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleDeploy(app)} disabled={busy}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors disabled:opacity-50 flex items-center gap-1.5">
                        {busy
                          ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deploying…</>
                          : "Deploy"
                        }
                      </button>
                    )}
                    <button onClick={() => handleDelete(app)} disabled={busy}
                      className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
