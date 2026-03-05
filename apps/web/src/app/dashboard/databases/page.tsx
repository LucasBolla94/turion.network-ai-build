"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type UserPublic } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth-store";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function DatabasesPage() {
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
          <h1 className="text-2xl font-bold text-white">Databases</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Managed PostgreSQL and Redis for your apps</p>
        </div>
        <ComingSoon
          icon="🗄"
          title="Managed Databases"
          description="Provision PostgreSQL and Redis databases in one click. Automatically connected to your apps, with backups and monitoring built in."
          features={["PostgreSQL 16", "Redis cache", "Automatic backups", "Connection pooling", "Query monitoring"]}
        />
      </main>
    </div>
  );
}

function ComingSoon({ icon, title, description, features }: {
  icon: string; title: string; description: string; features: string[];
}) {
  return (
    <div className="max-w-2xl">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">{icon}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-[var(--brand)]/10 border border-[var(--brand)]/30 text-[var(--brand)] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
          Coming soon
        </div>
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
        <p className="text-[var(--muted)] text-sm mb-6 max-w-md mx-auto leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {features.map(f => (
            <span key={f} className="bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] text-xs px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
