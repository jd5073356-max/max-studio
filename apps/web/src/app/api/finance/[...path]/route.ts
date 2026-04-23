import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") || "http://18.220.183.180:8003";
    const pathParams = await params;
    const backendPath = `/finance/${pathParams.path.join("/")}`;
    
    const url = new URL(`${gatewayUrl}${backendPath}`);
    // Añadir search params si los hay (ej: ?period=1mo)
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json"
      },
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from backend" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
