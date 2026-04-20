import type { ApiErrorBody } from "@/types/api";
import { getToken } from "@/store/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  if (!GATEWAY_URL) {
    throw new Error("NEXT_PUBLIC_GATEWAY_URL no configurado");
  }

  const { body, headers, ...rest } = options;
  const token = getToken();
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(`${GATEWAY_URL}${path}`, init);

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const parsed = (await res.json()) as ApiErrorBody;
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      // cuerpo vacío o no-JSON
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined as T;

  return (await res.json()) as T;
}
