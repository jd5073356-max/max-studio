/**
 * Proxy de logout: limpia la cookie max_auth del dominio Vercel
 * y notifica al gateway para que invalide la sesión allá también.
 */
import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;
const COOKIE_NAME = "max_auth";

export async function POST() {
  // Avisar al gateway (best-effort, no bloqueamos si falla)
  if (GATEWAY_URL) {
    try {
      await fetch(`${GATEWAY_URL}/auth/logout`, { method: "POST" });
    } catch {
      // ignorar — igual limpiamos la cookie local
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
