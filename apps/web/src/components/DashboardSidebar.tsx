"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth-store";
import type { UserPublic } from "@/lib/api";

const NAV = [
  { icon: "▦",  label: "Dashboard",  href: "/dashboard" },
  { icon: "⚡",  label: "My Apps",    href: "/dashboard/apps" },
  { icon: "🤖", label: "AI Builder", href: "/dashboard/builder" },
  { icon: "🗄",  label: "Databases",  href: "/dashboard/databases" },
  { icon: "🌐", label: "Domains",    href: "/dashboard/domains" },
  { icon: "💳", label: "Billing",    href: "/dashboard/billing" },
  { icon: "⚙",  label: "Settings",   href: "/dashboard/settings" },
];

const PLAN_COLOR: Record<string, string> = {
  free: "text-gray-400",
  pro:  "text-blue-400",
  team: "text-purple-400",
};

export default function DashboardSidebar({ user }: { user: UserPublic | null }) {
  const pathname = usePathname();
  const router   = useRouter();

  function handleLogout() {
    clearSession();
    router.push("/");
  }

  return (
    <aside className="w-60 border-r border-[var(--border)] flex flex-col p-4 shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mb-8 group">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center group-hover:opacity-90 transition-opacity">
          <span className="text-white font-bold text-sm">T</span>
        </div>
        <span className="text-white font-semibold">Turion</span>
      </Link>

      {/* Nav */}
      <nav className="space-y-0.5 flex-1">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.label} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                active
                  ? "bg-[var(--surface-hover)] text-white font-medium"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)]"
              }`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-[var(--border)] pt-4">
        {user && (
          <div className="px-3 py-2 mb-2">
            <div className="text-white text-sm font-medium truncate">{user.name}</div>
            <div className="text-[var(--muted)] text-xs truncate">{user.email}</div>
            <span className={`text-xs font-semibold uppercase tracking-wide mt-1 block ${PLAN_COLOR[user.plan] ?? "text-gray-400"}`}>
              {user.plan} plan
            </span>
          </div>
        )}
        <button onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm">
          Sign out
        </button>
      </div>
    </aside>
  );
}
