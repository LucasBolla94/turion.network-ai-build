"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /dashboard/new redirects straight to the AI Builder
export default function NewAppPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/builder"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="flex items-center gap-3 text-[var(--muted)] text-sm">
        <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand)] rounded-full animate-spin" />
        Opening AI Builder…
      </div>
    </div>
  );
}
