"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

const PLAN_LIMIT: Record<string, string>  = { free: "50K", pro: "3M", team: "10M" };
const PLAN_COLOR: Record<string, string>  = { free: "text-gray-400", pro: "text-blue-400", team: "text-purple-400" };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(getUser());

  useEffect(() => {
    auth.me().then(setUser).catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  const monthlyLimit = user?.plan === "team" ? 10_000_000 : user?.plan === "pro" ? 3_000_000 : 50_000;
  const usedPct = user ? Math.min(100, (user.tokens_used_month / monthlyLimit) * 100) : 0;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <DashboardSidebar user={user} />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-[var(--muted)] text-sm mt-1">Here's an overview of your account</p>
          </div>
          <Link href="/dashboard/builder"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            + Build new app
          </Link>
        </div>

        {/* Stats */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="text-[var(--muted)] text-xs mb-1">Active Apps</div>
              <div className="text-2xl font-bold text-white">{user.apps_count}</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {user.plan === "free" ? "of 3 on Free plan" : "Unlimited"}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[var(--muted)] text-xs">Tokens this month</div>
                <span className="text-xs text-[var(--muted)] font-mono">
                  {user.tokens_used_month.toLocaleString()} / {PLAN_LIMIT[user.plan]}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--background)] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${usedPct > 85 ? "bg-red-500" : "bg-[var(--brand)]"}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              {user.tokens_topup_balance > 0 && (
                <div className="text-xs text-green-400">
                  + {user.tokens_topup_balance.toLocaleString()} top-up available
                </div>
              )}
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="text-[var(--muted)] text-xs mb-1">Plan</div>
              <div className={`text-2xl font-bold capitalize ${PLAN_COLOR[user.plan] ?? "text-white"}`}>
                {user.plan}
              </div>
              <Link href="/dashboard/billing"
                className="text-xs text-[var(--brand)] hover:underline mt-1 block">
                {user.plan === "free" ? "Upgrade →" : "Manage plan →"}
              </Link>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon: "🤖", title: "AI Builder",
              desc: "Describe an app and AI generates it instantly.",
              href: "/dashboard/builder", cta: "Open Builder"
            },
            {
              icon: "⚡", title: "My Apps",
              desc: "View and manage all your deployed apps.",
              href: "/dashboard/apps", cta: "View Apps"
            },
            {
              icon: "💳", title: "Billing & Tokens",
              desc: "Manage your plan or top up token balance.",
              href: "/dashboard/billing", cta: "Manage Billing"
            },
          ].map(card => (
            <div key={card.href} className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] rounded-2xl p-6 transition-colors group">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
              <p className="text-[var(--muted)] text-xs mb-4 leading-relaxed">{card.desc}</p>
              <Link href={card.href}
                className="text-xs text-[var(--brand)] font-medium hover:underline">
                {card.cta} →
              </Link>
            </div>
          ))}
        </div>

        {/* Empty apps state */}
        {user?.apps_count === 0 && (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-14 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-white font-semibold text-lg mb-2">Create your first app</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-sm">
              Describe what you want to build in plain language — our AI generates the full code and deploys it in minutes.
            </p>
            <Link href="/dashboard/builder"
              className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors">
              Start building →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
