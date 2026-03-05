"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(null);

  useEffect(() => {
    // Load cached user immediately, then refresh from API
    const cached = getUser();
    if (cached) setUser(cached);

    auth.me().then(setUser).catch(() => {
      clearSession();
      router.replace("/login");
    });
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/");
  }

  const planLimit = { free: "100k", pro: "2M", team: "10M" };
  const planColor = { free: "text-gray-400", pro: "text-blue-400", team: "text-purple-400" };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-60 border-r border-[var(--border)] flex flex-col p-4 shrink-0">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-white font-semibold">Turion</span>
          </div>

          <nav className="space-y-1 flex-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)] transition-colors text-sm"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-[var(--border)] pt-4">
            {user && (
              <div className="px-3 py-2 mb-2">
                <div className="text-white text-sm font-medium truncate">{user.name}</div>
                <div className="text-[var(--muted)] text-xs truncate">{user.email}</div>
                <span className={`text-xs font-medium uppercase tracking-wide mt-1 block ${planColor[user.plan]}`}>
                  {user.plan} plan
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {user ? `Welcome, ${user.name.split(" ")[0]}` : "Dashboard"}
              </h1>
              <p className="text-[var(--muted)] text-sm mt-1">Manage and create your projects</p>
            </div>
            <Link
              href="/dashboard/new"
              className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              + New App
            </Link>
          </div>

          {/* Stats from real user data */}
          {user && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="text-[var(--muted)] text-sm mb-1">Active Apps</div>
                <div className="text-2xl font-bold text-white">{user.apps_count}</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {user.plan === "free" ? `of 3 on Free plan` : "Unlimited"}
                </div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="text-[var(--muted)] text-sm mb-1">Tokens this month</div>
                <div className="text-2xl font-bold text-white">
                  {user.tokens_used_month.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  of {planLimit[user.plan]} available
                </div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="text-[var(--muted)] text-sm mb-1">Plan</div>
                <div className={`text-2xl font-bold capitalize ${planColor[user.plan]}`}>
                  {user.plan}
                </div>
                <Link href="/dashboard/billing" className="text-xs text-[var(--brand)] hover:underline mt-1 block">
                  {user.plan === "free" ? "Upgrade →" : "Manage plan →"}
                </Link>
              </div>
            </div>
          )}

          {/* Empty state — no apps yet */}
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-white font-semibold text-lg mb-2">Create your first app</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-sm">
              Describe what you want to build in plain language and our AI will generate it for you in minutes.
            </p>
            <Link
              href="/dashboard/new"
              className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
            >
              Start building →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

const sidebarItems = [
  { icon: "▦", label: "Dashboard", href: "/dashboard" },
  { icon: "⚙", label: "My Apps", href: "/dashboard/apps" },
  { icon: "🤖", label: "AI Builder", href: "/dashboard/builder" },
  { icon: "🗄", label: "Databases", href: "/dashboard/databases" },
  { icon: "🌐", label: "Domains", href: "/dashboard/domains" },
  { icon: "💳", label: "Billing", href: "/dashboard/billing" },
  { icon: "⚙", label: "Settings", href: "/dashboard/settings" },
];
