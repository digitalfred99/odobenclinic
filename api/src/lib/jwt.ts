import jwt, { SignOptions } from "jsonwebtoken";
import type { UserRole } from "@/database/entities/User";

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  // include a token version/jti here later if you want server-side
  // revocation (needed for REFRESH_TOKEN_REUSE detection)
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "30d";

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error(
    "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env"
  );
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: "access" };
  return jwt.sign(payload, ACCESS_SECRET!, {
    expiresIn: ACCESS_EXPIRES,
  } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh" };
  return jwt.sign(payload, REFRESH_SECRET!, {
    expiresIn: REFRESH_EXPIRES,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET!) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new Error("WRONG_TOKEN_TYPE");
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET!) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("WRONG_TOKEN_TYPE");
  }
  return decoded;
}