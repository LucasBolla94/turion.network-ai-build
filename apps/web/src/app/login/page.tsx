import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--brand)] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Entrar na sua conta</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Nao tem conta?{" "}
            <Link href="/register" className="text-[var(--brand)] hover:underline">
              Criar gratis
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)] transition-colors text-sm"
              />
            </div>
            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-xs text-[var(--muted)] hover:text-white transition-colors">
                Esqueci minha senha
              </Link>
            </div>
            <button
              type="submit"
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white py-3 rounded-lg font-medium text-sm transition-colors mt-2"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
