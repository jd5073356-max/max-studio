import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { ApiErrorBody, LoginResponse, User } from "@/types/api";
import { ApiError } from "@/lib/api";

/**
 * Login: va a /api/auth/login (Next.js Route Handler, mismo dominio Vercel).
 * El route handler llama al gateway, setea la cookie max_auth en vercel.app
 * (para el middleware) y devuelve el JWT en el body para que el cliente
 * lo envíe como Bearer en llamadas cross-origin al gateway.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as LoginResponse | ApiErrorBody;

  if (!res.ok) {
    const detail = (data as ApiErrorBody).detail ?? res.statusText;
    throw new ApiError(res.status, detail);
  }

  const loginData = data as LoginResponse;

  // Guardar token para usarlo como Bearer en llamadas al gateway
  if (loginData.access_token) {
    useAuthStore.getState().setToken(loginData.access_token);
  }

  return loginData;
}

/**
 * Logout: limpia el token local y la cookie en el servidor.
 */
export async function logout(): Promise<void> {
  useAuthStore.getState().clearToken();
  await fetch("/api/auth/logout", { method: "POST" });
}

/**
 * Me: va al gateway directamente con Bearer token.
 */
export function me() {
  return apiFetch<User>("/auth/me");
}
