const API_BASE = "/api-backend/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? "Unknown error");
  }

  return data as T;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("turion_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Auth ---

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "team";
  currency: "GBP" | "BRL";
  locale: string;
  is_verified: boolean;
  tokens_used_month: number;
  apps_count: number;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export const auth = {
  register: (body: { name: string; email: string; password: string; locale?: string; currency?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  me: () =>
    request<UserPublic>("/auth/me", { headers: authHeaders() }),
};
