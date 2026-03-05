export type Locale = "en" | "pt-BR";

export const defaultLocale: Locale = "en";

export interface Translations {
  nav: { signin: string; start: string };
  hero: { badge: string; title1: string; title2: string; subtitle: string; cta_primary: string; cta_secondary: string };
  features: { ai_title: string; ai_desc: string; deploy_title: string; deploy_desc: string; db_title: string; db_desc: string; auth_title: string; auth_desc: string; payments_title: string; payments_desc: string; domain_title: string; domain_desc: string };
  plans: {
    title: string;
    free: { name: string; period: string; cta: string; features: string[] };
    pro: { name: string; period: string; cta: string; features: string[] };
    team: { name: string; period: string; cta: string; features: string[] };
  };
  footer: string;
  auth: { login_title: string; login_subtitle: string; login_link: string; forgot: string; email: string; password: string; btn_login: string; register_title: string; register_subtitle: string; register_link: string; name: string; name_placeholder: string; email_placeholder: string; password_placeholder: string; btn_register: string; terms: string; terms_link: string };
}

const en: Translations = {
  nav: { signin: "Sign in", start: "Get started free" },
  hero: {
    badge: "Platform launching soon!",
    title1: "Build full apps with",
    title2: "Artificial Intelligence",
    subtitle: "Describe what you want to build. Our AI writes the code, sets up the database and publishes your app with its own subdomain — in minutes.",
    cta_primary: "Get started free →",
    cta_secondary: "See how it works",
  },
  features: {
    ai_title: "Multi-Model AI", ai_desc: "Smart routing between GPT-4o, Claude 3.7, Gemini 2.5 and more. The best model is chosen automatically for each task.",
    deploy_title: "1-Click Deploy", deploy_desc: "Your app goes live at name.turion.network in seconds, with automatic SSL and zero configuration.",
    db_title: "Database Included", db_desc: "PostgreSQL automatically configured for each project. No servers to manage.",
    auth_title: "Auth Ready", auth_desc: "Login, registration and user management already included in every generated app.",
    payments_title: "Stripe Payments", payments_desc: "Integrate Stripe in your app with 1 click. Accept cards and subscriptions effortlessly.",
    domain_title: "Custom Domain", domain_desc: "Use the free subdomain or point your own domain. Automatic SSL in both cases.",
  },
  plans: {
    title: "Simple and affordable plans",
    free: { name: "Free", period: "forever", cta: "Get started free", features: ["3 active apps", "Subdomain .turion.network", "100k tokens/month", "Database included"] },
    pro: { name: "Pro", period: "per month", cta: "Subscribe Pro", features: ["Unlimited apps", "Custom domain", "2M tokens/month", "Priority support", "No cold start"] },
    team: { name: "Team", period: "per month", cta: "Subscribe Team", features: ["Everything in Pro", "5 collaborators", "10M tokens/month", "Auto CI/CD", "99.9% SLA"] },
  },
  footer: "© 2026 Turion Network. All rights reserved.",
  auth: {
    login_title: "Sign in to your account", login_subtitle: "Don't have an account?", login_link: "Create for free",
    forgot: "Forgot my password", email: "Email", password: "Password", btn_login: "Sign in",
    register_title: "Create free account", register_subtitle: "Already have an account?", register_link: "Sign in",
    name: "Full name", name_placeholder: "Your name", email_placeholder: "your@email.com", password_placeholder: "At least 8 characters",
    btn_register: "Create free account", terms: "By creating an account, you agree to our", terms_link: "Terms of Service",
  },
};

const ptBR: Translations = {
  nav: { signin: "Entrar", start: "Comecar gratis" },
  hero: {
    badge: "Plataforma em construcao — em breve!",
    title1: "Crie apps completos com",
    title2: "Inteligencia Artificial",
    subtitle: "Descreva o que voce quer construir. Nossa IA escreve o codigo, cria o banco de dados e publica o app com um subdominio proprio — em minutos.",
    cta_primary: "Comecar gratis →",
    cta_secondary: "Ver como funciona",
  },
  features: {
    ai_title: "IA Multi-Modelo", ai_desc: "Roteamento inteligente entre GPT-4o, Claude 3.7, Gemini 2.5 e mais. O melhor modelo e escolhido automaticamente para cada tarefa.",
    deploy_title: "Deploy em 1 Clique", deploy_desc: "Seu app fica disponivel em nome.turion.network em segundos, com SSL automatico e zero configuracao.",
    db_title: "Banco de Dados Incluido", db_desc: "PostgreSQL configurado automaticamente para cada projeto. Sem servidores para gerenciar.",
    auth_title: "Autenticacao Pronta", auth_desc: "Login, registro e controle de usuarios ja vem incluido em cada app gerado pela plataforma.",
    payments_title: "Pagamentos com Stripe", payments_desc: "Integre Stripe no seu app com 1 clique. Aceite cartao e assinaturas sem esforco.",
    domain_title: "Dominio Proprio", domain_desc: "Use o subdominio gratuito ou aponte seu proprio dominio. SSL automatico em ambos os casos.",
  },
  plans: {
    title: "Planos simples e acessiveis",
    free: { name: "Gratis", period: "para sempre", cta: "Comecar gratis", features: ["3 apps ativos", "Subdominio .turion.network", "100k tokens/mes", "Banco de dados incluido"] },
    pro: { name: "Pro", period: "por mes", cta: "Assinar Pro", features: ["Apps ilimitados", "Dominio proprio", "2M tokens/mes", "Suporte prioritario", "Sem cold start"] },
    team: { name: "Team", period: "por mes", cta: "Assinar Team", features: ["Tudo do Pro", "5 colaboradores", "10M tokens/mes", "CI/CD automatico", "SLA 99.9%"] },
  },
  footer: "© 2026 Turion Network. Todos os direitos reservados.",
  auth: {
    login_title: "Entrar na sua conta", login_subtitle: "Nao tem conta?", login_link: "Criar gratis",
    forgot: "Esqueci minha senha", email: "Email", password: "Senha", btn_login: "Entrar",
    register_title: "Criar conta gratis", register_subtitle: "Ja tem conta?", register_link: "Entrar",
    name: "Nome completo", name_placeholder: "Seu nome", email_placeholder: "seu@email.com", password_placeholder: "Minimo 8 caracteres",
    btn_register: "Criar conta gratis", terms: "Ao criar uma conta, voce concorda com os", terms_link: "Termos de Uso",
  },
};

export const translations: Record<Locale, Translations> = { en, "pt-BR": ptBR };

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? translations[defaultLocale];
}
