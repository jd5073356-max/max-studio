import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "max_auth";
const LOGIN_PATH = "/login";
const DEFAULT_APP_PATH = "/chat";
// Rutas públicas (no requieren auth). Ojo: /offline se sirve desde el SW
// como fallback cuando no hay red, debe responder sin redirect.
const PUBLIC_PATHS = new Set<string>([LOGIN_PATH, "/offline"]);

export function proxy(request: NextRequest) {
  const hasAuth = request.cookies.has(COOKIE_NAME);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasAuth && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (hasAuth && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_APP_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluir: estáticos de Next, iconos dinámicos (icon/apple-icon), manifest
  // (tanto .json como .webmanifest), SW, favicon y cualquier archivo con extensión.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|manifest\\.webmanifest|sw\\.js|icon|apple-icon|icons|.*\\..*).*)",
  ],
};
