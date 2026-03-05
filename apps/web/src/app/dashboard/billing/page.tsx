"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, ApiError, type UserPublic } from "@/lib/api";
import { getUser, getToken, clearSession } from "@/lib/auth-store";

const API = "/api-backend/v1";

interface Plan {
  id: "pro" | "team";
  name: string;
  gbp: string;
  brl: string;
  period: string;
  features: string[];
  highlight: boolean;
}

const plans: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    gbp: "£49",
    brl: "R$ 297",
    period: "/ month",
    highlight: true,
    features: ["Unlimited apps", "Custom domain", "2M tokens/month", "Priority support", "No cold start"],
  },
  {
    id: "team",
    name: "Team",
    gbp: "£129",
    brl: "R$ 747",
    period: "/ month",
    highlight: false,
    features: ["Everything in Pro", "5 collaborators", "10M tokens/month", "Auto CI/CD", "99.9% SLA"],
  },
];

export default function BillingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<UserPublic | null>(getUser());
  const [currency, setCurrency] = useState<"GBP" | "BRL">("GBP");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    auth.me().then(u => {
      setUser(u);
      setCurrency(u.currency ?? "GBP");
    }).catch(() => { clearSession(); router.replace("/login"); });

    if (params.get("success")) showToast("Payment confirmed! Your plan has been upgraded.", "success");
    if (params.get("cancelled")) showToast("Checkout cancelled. No charge was made.", "error");
  }, [router, params]);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleUpgrade(plan: "pro" | "team") {
    setLoading(plan);
    try {
      const token = getToken();
      const res = await fetch(`${API}/billing/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error creating checkout");
      window.location.href = data.checkout_url;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Something went wrong", "error");
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const token = getToken();
      const res = await fetch(`${API}/billing/create-portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error");
      window.location.href = data.portal_url;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Something went wrong", "error");
      setLoading(null);
    }
  }

  const isCurrentPlan = (planId: string) => user?.plan === planId;
  const isPaid = user?.plan !== "free";

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
            {[
              { icon: "▦", label: "Dashboard", href: "/dashboard" },
              { icon: "⚙", label: "My Apps", href: "/dashboard/apps" },
              { icon: "🤖", label: "AI Builder", href: "/dashboard/builder" },
              { icon: "💳", label: "Billing", href: "/dashboard/billing" },
              { icon: "⚙", label: "Settings", href: "/dashboard/settings" },
            ].map((item) => (
              <Link key={item.label} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  item.href === "/dashboard/billing"
                    ? "bg-[var(--surface-hover)] text-white"
                    : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)]"
                }`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="border-t border-[var(--border)] pt-4 px-3 py-2">
              <div className="text-white text-sm font-medium truncate">{user.name}</div>
              <div className="text-[var(--muted)] text-xs truncate">{user.email}</div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-8">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg ${
              toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}>
              {toast.msg}
            </div>
          )}

          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
                <p className="text-[var(--muted)] text-sm mt-1">
                  Current plan: <span className="text-white font-medium capitalize">{user?.plan ?? "..."}</span>
                </p>
              </div>

              {/* Currency toggle */}
              <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
                {(["GBP", "BRL"] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      currency === c ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-white"
                    }`}>
                    {c === "GBP" ? "£ GBP" : "R$ BRL"}
                  </button>
                ))}
              </div>
            </div>

            {/* Current plan banner */}
            {isPaid && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-8 flex items-center justify-between">
                <div>
                  <div className="text-green-400 font-semibold capitalize">{user?.plan} Plan — Active</div>
                  <div className="text-[var(--muted)] text-sm mt-1">
                    Manage your subscription, update payment method or cancel anytime.
                  </div>
                </div>
                <button onClick={handlePortal} disabled={loading === "portal"}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-2">
                  {loading === "portal" && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Manage subscription →
                </button>
              </div>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Free */}
              <div className={`bg-[var(--surface)] border rounded-2xl p-6 ${
                user?.plan === "free" ? "border-[var(--brand)]" : "border-[var(--border)]"
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-white">Free</div>
                  {user?.plan === "free" && (
                    <span className="text-xs bg-[var(--brand)]/20 text-[var(--brand)] px-2 py-1 rounded-full font-medium">Current plan</span>
                  )}
                </div>
                <div className="text-3xl font-bold text-white mb-1">£0</div>
                <div className="text-sm text-[var(--muted)] mb-5">forever</div>
                <ul className="space-y-2 mb-6">
                  {["3 active apps", "Subdomain .turion.network", "100k tokens/month", "Community support"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted)]"><span className="text-green-400">✓</span>{f}</li>
                  ))}
                </ul>
                <div className="py-2.5 text-center text-sm text-[var(--muted)]">Your current plan</div>
              </div>

              {/* Paid plans */}
              {plans.map((plan) => (
                <div key={plan.id} className={`rounded-2xl p-6 border ${
                  plan.highlight ? "bg-[var(--brand)] border-[var(--brand)]" : "bg-[var(--surface)] border-[var(--border)]"
                } ${isCurrentPlan(plan.id) ? "ring-2 ring-white/30" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-white">{plan.name}</div>
                    {isCurrentPlan(plan.id) && (
                      <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full font-medium">Current plan</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {currency === "GBP" ? plan.gbp : plan.brl}
                  </div>
                  <div className="text-sm text-white/60 mb-5">{plan.period}</div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/90"><span>✓</span>{f}</li>
                    ))}
                  </ul>

                  {isCurrentPlan(plan.id) ? (
                    <button onClick={handlePortal}
                      className="w-full py-2.5 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white transition-colors">
                      Manage plan
                    </button>
                  ) : (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={!!loading}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                        plan.highlight ? "bg-white text-[var(--brand)] hover:bg-gray-100" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
                      }`}>
                      {loading === plan.id ? (
                        <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />Redirecting...</>
                      ) : (
                        `Upgrade to ${plan.name} →`
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Test mode notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4 text-sm">
              <span className="text-yellow-400 font-semibold">Test Mode</span>
              <span className="text-[var(--muted)] ml-2">
                Use card <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">4242 4242 4242 4242</code>, any future expiry, any CVV to test payment.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
