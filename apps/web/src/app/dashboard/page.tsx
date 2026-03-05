"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

const PLAN_LIMIT: Record<string, number> = { free: 50_000, pro: 3_000_000, team: 10_000_000 };
const PLAN_LIMIT_LABEL: Record<string, string> = { free: "50K", pro: "3M", team: "10M" };
const PLAN_COLOR: Record<string, string> = { free: "text-gray-400", pro: "text-blue-400", team: "text-purple-400" };

interface UsageDay { date: string; tokens_used: number }

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function UsageChart({ data }: { data: UsageDay[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: UsageDay } | null>(null);
  const W = 600, H = 120, PAD = { t: 8, b: 28, l: 4, r: 4 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map(d => d.tokens_used), 1);
  const barW = chartW / data.length;
  const barGap = Math.max(2, barW * 0.18);

  const fmtDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en", { month: "short", day: "numeric" });
  };
  const fmtNum = (n: number) =>
    n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : String(n);

  // Show label every N bars depending on count
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="relative select-none" style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f}
            x1={PAD.l} y1={PAD.t + chartH * (1 - f)}
            x2={W - PAD.r} y2={PAD.t + chartH * (1 - f)}
            stroke="#1e1e2e" strokeWidth="1"
          />
        ))}

        {data.map((day, i) => {
          const h = (day.tokens_used / maxVal) * chartH;
          const x = PAD.l + i * barW + barGap / 2;
          const y = PAD.t + chartH - h;
          const w = barW - barGap;
          const showLabel = i % labelEvery === 0;

          return (
            <g key={day.date}
              onMouseEnter={e => setTooltip({ x: x + w / 2, y, day })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "default" }}>
              <rect x={x} y={PAD.t} width={w} height={chartH} fill="transparent" />
              {day.tokens_used > 0 && (
                <rect
                  x={x} y={y} width={w} height={h}
                  rx="3" ry="3"
                  fill={tooltip?.day.date === day.date ? "#4c6ef5" : "#3b5bdb"}
                  style={{ transition: "fill .15s" }}
                />
              )}
              {showLabel && (
                <text
                  x={x + w / 2} y={H - 4}
                  textAnchor="middle"
                  fontSize="9" fill="#555"
                  fontFamily="system-ui,sans-serif">
                  {fmtDate(day.date)}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (() => {
          const tx = Math.min(Math.max(tooltip.x, 50), W - 50);
          const ty = Math.max(tooltip.y - 6, PAD.t + 4);
          return (
            <g>
              <rect x={tx - 40} y={ty - 20} width={80} height={22} rx="5" fill="#1a1a2e" />
              <text x={tx} y={ty - 5} textAnchor="middle"
                fontSize="10" fill="#fff" fontFamily="system-ui,sans-serif">
                {fmtNum(tooltip.day.tokens_used)} tokens
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Verification Banner ───────────────────────────────────────────────────────
function VerificationBanner({ user }: { user: UserPublic }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await auth.sendVerification();
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (user.is_verified) return null;

  return (
    <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-yellow-400 text-lg">✉️</span>
        <p className="text-yellow-200 text-sm">
          Please verify your email address to unlock all features.
        </p>
      </div>
      {sent ? (
        <span className="text-green-400 text-xs shrink-0">Sent!</span>
      ) : (
        <button onClick={resend} disabled={sending}
          className="text-xs text-yellow-400 hover:text-yellow-200 border border-yellow-500/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0">
          {sending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(getUser());
  const [usage, setUsage] = useState<UsageDay[]>([]);
  const [usageDays, setUsageDays] = useState<7 | 30>(30);

  useEffect(() => {
    auth.me().then(setUser).catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  useEffect(() => {
    auth.getUsage(usageDays).then(setUsage).catch(() => {});
  }, [usageDays]);

  const monthlyLimit = PLAN_LIMIT[user?.plan ?? "free"];
  const usedPct = user ? Math.min(100, (user.tokens_used_month / monthlyLimit) * 100) : 0;
  const totalUsage = usage.reduce((s, d) => s + d.tokens_used, 0);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      <DashboardSidebar user={user} />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-[var(--muted)] text-sm mt-1">Overview of your account</p>
          </div>
          <Link href="/dashboard/builder"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            + Build new app
          </Link>
        </div>

        {/* Email verification banner */}
        {user && <VerificationBanner user={user} />}

        {/* Stats */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="text-[var(--muted)] text-xs mb-1">Active Apps</div>
              <div className="text-2xl font-bold text-white">{user.apps_count}</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {user.plan === "free" ? "up to 3 on Free plan" : "Unlimited"}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[var(--muted)] text-xs">Tokens this month</div>
                <span className="text-xs text-[var(--muted)] font-mono">
                  {user.tokens_used_month.toLocaleString()} / {PLAN_LIMIT_LABEL[user.plan]}
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
                  + {user.tokens_topup_balance.toLocaleString()} top-up
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

        {/* Token usage chart */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Token Usage</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {totalUsage.toLocaleString()} tokens in last {usageDays} days
              </p>
            </div>
            <div className="flex gap-1">
              {([7, 30] as const).map(d => (
                <button key={d} onClick={() => setUsageDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    usageDays === d
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--muted)] hover:text-white border border-[var(--border)]"
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          {usage.length > 0 ? (
            <UsageChart data={usage} />
          ) : (
            <div className="h-28 flex items-center justify-center text-[var(--muted)] text-sm">
              No usage data yet
            </div>
          )}
        </div>

        {/* Quick actions */}
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { icon: "🤖", title: "AI Builder", desc: "Describe an app and AI generates it instantly.", href: "/dashboard/builder", cta: "Open Builder" },
            { icon: "⚡", title: "My Apps", desc: "View and manage all your deployed apps.", href: "/dashboard/apps", cta: "View Apps" },
            { icon: "💳", title: "Billing & Tokens", desc: "Manage your plan or top up token balance.", href: "/dashboard/billing", cta: "Manage Billing" },
          ].map(card => (
            <div key={card.href}
              className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] rounded-2xl p-5 transition-colors">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
              <p className="text-[var(--muted)] text-xs mb-3 leading-relaxed">{card.desc}</p>
              <Link href={card.href} className="text-xs text-[var(--brand)] font-medium hover:underline">
                {card.cta} →
              </Link>
            </div>
          ))}
        </div>

        {user?.apps_count === 0 && (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-14 flex flex-col items-center text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-white font-semibold text-lg mb-2">Create your first app</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-sm">
              Describe what you want to build — our AI generates the full code and deploys it in minutes.
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
