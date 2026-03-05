import Link from "next/link";
import { getTranslations } from "@/i18n/translations";
import { prices } from "@/i18n/prices";

// Default locale is English, currency GBP
// Locale switching is handled client-side via a toggle component
export default function HomePage() {
  const t = getTranslations("en");
  const p = prices["GBP"];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Navbar */}
      <nav className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="text-white font-semibold text-lg">Turion Network</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[var(--muted)] hover:text-white transition-colors text-sm">
            {t.nav.signin}
          </Link>
          <Link
            href="/register"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {t.nav.start}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-1.5 text-sm text-[var(--muted)] mb-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {t.hero.badge}
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight max-w-4xl">
          {t.hero.title1}{" "}
          <span className="text-[var(--brand)]">{t.hero.title2}</span>
        </h1>

        <p className="text-[var(--muted)] text-xl md:text-2xl max-w-2xl mb-10 leading-relaxed">
          {t.hero.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link
            href="/register"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105"
          >
            {t.hero.cta_primary}
          </Link>
          <Link
            href="#features"
            className="border border-[var(--border)] hover:border-[var(--muted)] text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
          >
            {t.hero.cta_secondary}
          </Link>
        </div>

        {/* Features grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-8">
          {[
            { icon: "🤖", title: t.features.ai_title, desc: t.features.ai_desc },
            { icon: "⚡", title: t.features.deploy_title, desc: t.features.deploy_desc },
            { icon: "🗄️", title: t.features.db_title, desc: t.features.db_desc },
            { icon: "🔒", title: t.features.auth_title, desc: t.features.auth_desc },
            { icon: "💳", title: t.features.payments_title, desc: t.features.payments_desc },
            { icon: "🌐", title: t.features.domain_title, desc: t.features.domain_desc },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-left hover:border-[var(--brand)] transition-colors"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-[var(--border)] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">{t.plans.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-white">
              <div className="text-sm font-medium mb-2 opacity-80">{t.plans.free.name}</div>
              <div className="text-4xl font-bold mb-1">£0</div>
              <div className="text-sm opacity-60 mb-6">{t.plans.free.period}</div>
              <ul className="space-y-2">
                {t.plans.free.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm opacity-90">
                    <span>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block text-center py-3 rounded-lg font-medium text-sm transition-colors bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
              >
                {t.plans.free.cta}
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div className="bg-[var(--brand)] border border-[var(--brand)] rounded-2xl p-6 text-white">
              <div className="text-sm font-medium mb-2 opacity-80">{t.plans.pro.name}</div>
              <div className="text-4xl font-bold mb-1">{p.pro}</div>
              <div className="text-sm opacity-60 mb-6">{t.plans.pro.period}</div>
              <ul className="space-y-2">
                {t.plans.pro.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm opacity-90">
                    <span>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block text-center py-3 rounded-lg font-medium text-sm transition-colors bg-white text-[var(--brand)] hover:bg-gray-100"
              >
                {t.plans.pro.cta}
              </Link>
            </div>

            {/* Team */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-white">
              <div className="text-sm font-medium mb-2 opacity-80">{t.plans.team.name}</div>
              <div className="text-4xl font-bold mb-1">{p.team}</div>
              <div className="text-sm opacity-60 mb-6">{t.plans.team.period}</div>
              <ul className="space-y-2">
                {t.plans.team.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm opacity-90">
                    <span>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block text-center py-3 rounded-lg font-medium text-sm transition-colors bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
              >
                {t.plans.team.cta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-8 text-center text-[var(--muted)] text-sm">
        <p>{t.footer}</p>
      </footer>
    </main>
  );
}
