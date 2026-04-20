import { apiFetch } from "@/lib/api";
import type { ApiErrorBody, LoginResponse, User } from "@/types/api";
import { ApiError } from "@/lib/api";

/**
 * Login: va a /api/auth/login (Next.js Route Handler, mismo dominio Vercel).
 * El route handler llama al gateway y setea la cookie max_auth en vercel.app,
 * para que el middleware proxy.ts la pueda leer.
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

  return data as LoginResponse;
}

/**
 * Logout: va a /api/auth/logout (Next.js Route Handler, mismo dominio Vercel).
 */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

/**
 * Me: va al gateway directamente (usa la cookie trycloudflare.com con credentials: include).
 */
export function me() {
  return apiFetch<User>("/auth/me");
}
