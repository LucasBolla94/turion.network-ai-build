import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turion Network — AI App Builder",
  description:
    "Crie, hospede e publique aplicacoes completas com Inteligencia Artificial. Sem codigo necessario.",
  keywords: ["AI", "app builder", "no-code", "inteligencia artificial"],
  openGraph: {
    title: "Turion Network",
    description: "Plataforma AI para construir e publicar apps",
    url: "https://turion.network",
    siteName: "Turion Network",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
