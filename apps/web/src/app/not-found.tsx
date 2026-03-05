import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: "var(--background)" }}
    >
      {/* Glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(99,102,241,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-lg w-full">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-12 group">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">T</span>
          </div>
          <span className="text-white font-semibold text-lg">Turion Network</span>
        </Link>

        {/* 404 display */}
        <div className="relative mb-8">
          <div
            className="text-[160px] font-black leading-none select-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </div>
          {/* Overlay text with brand gradient */}
          <div
            className="absolute inset-0 flex items-center justify-center text-[160px] font-black leading-none select-none"
            style={{
              background: "linear-gradient(135deg, var(--brand) 0%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              opacity: 0.35,
            }}
          >
            404
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Page not found
        </h1>
        <p className="text-[var(--muted)] text-sm leading-relaxed mb-10 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-7 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-white px-7 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Dashboard →
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-4">You might be looking for</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: "AI Builder",  href: "/dashboard/builder" },
              { label: "Billing",     href: "/dashboard/billing" },
              { label: "My Apps",     href: "/dashboard/apps" },
              { label: "Login",       href: "/login" },
              { label: "Register",    href: "/register" },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--muted)] hover:text-white text-xs px-4 py-2 rounded-full transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
