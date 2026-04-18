import { apiFetch } from "@/lib/api";
import type { LoginResponse, User } from "@/types/api";

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function logout() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function me() {
  return apiFetch<User>("/auth/me");
}
