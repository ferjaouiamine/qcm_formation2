import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { VercelRequest, VercelResponse } from "@vercel/node";
export const hashToken = (t: string) =>
  createHash("sha256").update(t).digest("hex");
export const makeAttemptToken = () => randomBytes(32).toString("base64url");
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");
export async function signAdmin(payload: { sub: string; role: string }) {
  if (secret().length < 32) throw new Error("JWT_SECRET invalide");
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}
export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const raw = req.headers.cookie?.match(/(?:^|; )admin_token=([^;]+)/)?.[1];
  if (!raw) {
    res.status(401).json({ error: { message: "Authentification requise" } });
    return null;
  }
  try {
    return (await jwtVerify(raw, secret())).payload;
  } catch {
    res.status(401).json({ error: { message: "Session invalide" } });
    return null;
  }
}
export const attemptToken = (req: VercelRequest) =>
  Array.isArray(req.headers["x-attempt-token"])
    ? req.headers["x-attempt-token"][0]
    : req.headers["x-attempt-token"];
