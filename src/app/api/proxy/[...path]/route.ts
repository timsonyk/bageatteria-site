import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
// Публичный хост, под которым бэк доступен снаружи. Бэкенд использует
// X-Forwarded-Host/Proto при построении абсолютных URL медиа. Без этого
// при SSR-вызовах через http://backend:8000 в media попадает хост
// `backend:8000`, который браузер не может зарезолвить.
const PUBLIC_BASE =
  process.env.NEXT_PUBLIC_MEDIA_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  BACKEND_URL;

function forwardedHeaders() {
  try {
    const u = new URL(PUBLIC_BASE);
    return {
      "X-Forwarded-Host": u.host,
      "X-Forwarded-Proto": u.protocol.replace(":", ""),
    } as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/${pathname}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...forwardedHeaders(),
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
