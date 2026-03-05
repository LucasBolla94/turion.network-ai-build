import Link from "next/link";

export default function HomePage() {
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
            Entrar
          </Link>
          <Link
            href="/register"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Comecar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-1.5 text-sm text-[var(--muted)] mb-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Plataforma em construcao — em breve!
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight max-w-4xl">
          Crie apps completos com{" "}
          <span className="text-[var(--brand)]">Inteligencia Artificial</span>
        </h1>

        <p className="text-[var(--muted)] text-xl md:text-2xl max-w-2xl mb-10 leading-relaxed">
          Descreva o que voce quer construir. Nossa IA escreve o codigo, cria o
          banco de dados e publica o app com um subdominio proprio — em minutos.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link
            href="/register"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105"
          >
            Comecar gratis →
          </Link>
          <Link
            href="#como-funciona"
            className="border border-[var(--border)] hover:border-[var(--muted)] text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
          >
            Ver como funciona
          </Link>
        </div>

        {/* Features grid */}
        <div id="como-funciona" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-8">
          {features.map((f) => (
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

      {/* Planos */}
      <section className="border-t border-[var(--border)] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Planos simples e acessiveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${
                  plan.highlight
                    ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                    : "bg-[var(--surface)] border-[var(--border)] text-white"
                }`}
              >
                <div className="text-sm font-medium mb-2 opacity-80">{plan.name}</div>
                <div className="text-4xl font-bold mb-1">{plan.price}</div>
                <div className="text-sm opacity-60 mb-6">{plan.period}</div>
                <ul className="space-y-2">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm opacity-90">
                      <span>✓</span> {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-6 block text-center py-3 rounded-lg font-medium text-sm transition-colors ${
                    plan.highlight
                      ? "bg-white text-[var(--brand)] hover:bg-gray-100"
                      : "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-8 text-center text-[var(--muted)] text-sm">
        <p>© 2026 Turion Network. Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}

const features = [
  {
    icon: "🤖",
    title: "IA Multi-Modelo",
    desc: "Roteamento inteligente entre GPT-4o, Claude 3.7, Gemini 2.5 e mais. O melhor modelo e escolhido automaticamente para cada tarefa.",
  },
  {
    icon: "⚡",
    title: "Deploy em 1 Clique",
    desc: "Seu app fica disponivel em nome.turion.network em segundos, com SSL automatico e zero configuracao.",
  },
  {
    icon: "🗄️",
    title: "Banco de Dados Incluido",
    desc: "PostgreSQL configurado automaticamente para cada projeto. Sem servidores para gerenciar.",
  },
  {
    icon: "🔒",
    title: "Autenticacao Pronta",
    desc: "Login, registro e controle de usuarios ja vem incluido em cada app gerado pela plataforma.",
  },
  {
    icon: "💳",
    title: "Pagamentos com Stripe",
    desc: "Integre Stripe no seu app com 1 clique. Aceite cartao, PIX e assinaturas sem esforco.",
  },
  {
    icon: "🌐",
    title: "Dominio Proprio",
    desc: "Use o subdominio gratuito ou aponte seu proprio dominio. SSL automatico em ambos os casos.",
  },
];

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    highlight: false,
    cta: "Comecar gratis",
    features: ["3 apps ativos", "Subdominio .turion.network", "100k tokens/mes", "Banco de dados incluido"],
  },
  {
    name: "Pro",
    price: "R$ 97",
    period: "por mes",
    highlight: true,
    cta: "Assinar Pro",
    features: ["Apps ilimitados", "Dominio proprio", "2M tokens/mes", "Suporte prioritario", "Sem cold start"],
  },
  {
    name: "Team",
    price: "R$ 247",
    period: "por mes",
    highlight: false,
    cta: "Assinar Team",
    features: ["Tudo do Pro", "5 colaboradores", "10M tokens/mes", "CI/CD automatico", "SLA 99.9%"],
  },
];
