/**
 * Proxy de login: llama al gateway, extrae el JWT del Set-Cookie
 * y lo re-setea como cookie httpOnly en el dominio Vercel.
 * Así el middleware (proxy.ts) puede leer max_auth en el mismo dominio.
 */
import { type NextRequest, NextResponse } from "next/server";

import type { ApiErrorBody, LoginResponse } from "@/types/api";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;
const COOKIE_NAME = "max_auth";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 días

export async function POST(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json<ApiErrorBody>(
      { detail: "Gateway no configurado" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiErrorBody>({ detail: "Body inválido" }, { status: 400 });
  }

  let gatewayRes: Response;
  try {
    gatewayRes = await fetch(`${GATEWAY_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json<ApiErrorBody>(
      { detail: "No se pudo contactar al gateway" },
      { status: 502 },
    );
  }

  const data = (await gatewayRes.json()) as LoginResponse | ApiErrorBody;

  if (!gatewayRes.ok) {
    return NextResponse.json(data, { status: gatewayRes.status });
  }

  // Extraer token del Set-Cookie que puso el gateway
  const setCookieHeader = gatewayRes.headers.get("set-cookie");
  const tokenMatch = setCookieHeader?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch?.[1];

  // Incluir el token en el body para que el cliente lo guarde y lo use como Bearer
  const responseData = { ...(data as object), access_token: token ?? "" } as LoginResponse;
  const res = NextResponse.json<LoginResponse>(responseData);

  if (token) {
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // mismo dominio → Lax es suficiente y más seguro que None
      maxAge: MAX_AGE,
      path: "/",
    });
  }

  return res;
}
