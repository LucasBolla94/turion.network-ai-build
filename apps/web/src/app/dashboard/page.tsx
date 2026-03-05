import Link from "next/link";

const mockApps = [
  { id: "1", name: "landing-page-loja", url: "landing-page-loja.turion.network", status: "online", updated: "2 min atras" },
  { id: "2", name: "crm-interno", url: "crm-interno.turion.network", status: "building", updated: "5 min atras" },
  { id: "3", name: "chatbot-suporte", url: "chatbot-suporte.turion.network", status: "online", updated: "1h atras" },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Sidebar */}
      <div className="flex h-screen">
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
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-xs font-bold">U</div>
              <div>
                <div className="text-white text-sm font-medium">Usuario</div>
                <div className="text-[var(--muted)] text-xs">Plano Free</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Meus Apps</h1>
              <p className="text-[var(--muted)] text-sm mt-1">Gerencie e crie seus projetos</p>
            </div>
            <Link
              href="/dashboard/new"
              className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <span>+</span> Novo App
            </Link>
          </div>

          {/* Apps list */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mockApps.map((app) => (
              <div
                key={app.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--brand)] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/20 flex items-center justify-center text-[var(--brand)] font-bold">
                    {app.name[0].toUpperCase()}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    app.status === "online"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {app.status === "online" ? "Online" : "Publicando..."}
                  </span>
                </div>
                <h3 className="text-white font-medium mb-1">{app.name}</h3>
                <p className="text-[var(--muted)] text-xs mb-4">{app.url}</p>
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>Atualizado {app.updated}</span>
                  <div className="flex gap-2">
                    <button className="hover:text-white transition-colors">Editar</button>
                    <span>·</span>
                    <a href={`https://${app.url}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      Ver site
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {/* Card de novo app */}
            <Link
              href="/dashboard/new"
              className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-5 hover:border-[var(--brand)] transition-colors flex flex-col items-center justify-center gap-3 min-h-[160px] text-[var(--muted)] hover:text-white"
            >
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Criar novo app</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="text-[var(--muted)] text-sm mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-green-400 mt-1">{stat.change}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

const sidebarItems = [
  { icon: "▦", label: "Dashboard", href: "/dashboard" },
  { icon: "⚙", label: "Meus Apps", href: "/dashboard/apps" },
  { icon: "🤖", label: "AI Builder", href: "/dashboard/builder" },
  { icon: "🗄", label: "Banco de Dados", href: "/dashboard/databases" },
  { icon: "🌐", label: "Dominios", href: "/dashboard/domains" },
  { icon: "💳", label: "Plano & Billing", href: "/dashboard/billing" },
  { icon: "⚙", label: "Configuracoes", href: "/dashboard/settings" },
];

const stats = [
  { label: "Apps ativos", value: "3", change: "+1 este mes" },
  { label: "Tokens usados", value: "24.5k", change: "de 100k disponiveis" },
  { label: "Requests hoje", value: "1,234", change: "+12% vs ontem" },
];
