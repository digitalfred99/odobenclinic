import { NextRequest, NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/* Allowed origins                                                     */
/* ------------------------------------------------------------------ */

// Development: local frontends only.
const DEV_ORIGINS = ["http://localhost:3001", "https://sjnm15x5-3001.uks1.devtunnels.ms"];

// Production: comes from the ALLOWED_ORIGINS env var, e.g.
// ALLOWED_ORIGINS=https://your_domain.org,https://www.your_domain.org
// No fallback, so if it is unset, browsers are blocked (fails closed).
const PROD_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";

// In dev, ALLOWED_ORIGINS (if set) is honored too, so you can test a tunnel URL.
const allowedOrigins = new Set(isProd ? PROD_ORIGINS : [...DEV_ORIGINS, ...PROD_ORIGINS]);

/* ------------------------------------------------------------------ */
/* CORS headers                                                        */
/* ------------------------------------------------------------------ */

function corsHeaders(origin: string | null) {
  const headers = new Headers();

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

/* ------------------------------------------------------------------ */
/* Proxy (Next.js 16 replacement for middleware)                       */
/* ------------------------------------------------------------------ */

export function proxy(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));

  // Preflight: answer immediately, no route handler needed.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};