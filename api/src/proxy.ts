//for development
import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = new Set([
  "http://localhost:3001",
]);

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = NextResponse.next();

  if (origin && allowedOrigins.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};


// // for production
// const allowedOrigins = new Set([
//   "http://localhost:3001",
//   "http://127.0.0.1:3001",
//   "https://yesvote.vercel.app",
// ]);

// function corsHeaders(origin: string | null) {
//   const headers = new Headers();

//   if (origin && allowedOrigins.has(origin)) {
//     headers.set("Access-Control-Allow-Origin", origin);
//     headers.set("Vary", "Origin");
//   }

//   headers.set(
//     "Access-Control-Allow-Methods",
//     "GET, POST, PUT, PATCH, DELETE, OPTIONS"
//   );

//   headers.set(
//     "Access-Control-Allow-Headers",
//     "Content-Type, Authorization"
//   );

//   headers.set("Access-Control-Max-Age", "86400");

//   return headers;
// }

// export function proxy(request: NextRequest) {
//   const headers = corsHeaders(request.headers.get("origin"));

//   if (request.method === "OPTIONS") {
//     return new NextResponse(null, {
//       status: 204,
//       headers,
//     });
//   }

//   const response = NextResponse.next();

//   headers.forEach((value, key) => {
//     response.headers.set(key, value);
//   });

//   return response;
// }

// export const config = {
//   matcher: "/api/:path*",
// };