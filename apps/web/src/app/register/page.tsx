import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--brand)] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Criar conta gratis</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Ja tem conta?{" "}
            <Link href="/login" className="text-[var(--brand)] hover:underline">
              Entrar
            </Link>
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Nome completo</label>
              <input
                type="text"
                placeholder="Seu nome"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:border-[var(--brand)] focus:outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Senha</label>
              <input
                type="password"
                placeholder="Minimo 8 caracteres"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white py-3 rounded-lg font-medium text-sm transition-colors"
            >
              Criar conta gratis
            </button>
            <p className="text-xs text-[var(--muted)] text-center">
              Ao criar uma conta, voce concorda com os{" "}
              <Link href="/terms" className="text-[var(--brand)] hover:underline">Termos de Uso</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
