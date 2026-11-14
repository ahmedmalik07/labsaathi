/**
 * Sessions. A session is bound to exactly one report.
 *
 * The session id is a signed, compressed token that carries the engine facts of
 * that one report (HMAC-SHA256). This makes the binding cryptographic instead of
 * a server-memory lookup, so it survives serverless cold starts on Vercel and a
 * client cannot swap in another patient's data: a changed token fails the signature.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { EngineFacts } from "./facts";

export interface SessionData {
  v: 1;
  name: string | null;
  mrn: string | null;
  facts: EngineFacts;
  iat: number;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET || `labsaathi:${process.env.GROQ_API_KEY ?? "local-dev-secret"}`;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createSession(data: Omit<SessionData, "v" | "iat">): string {
  const payload: SessionData = { v: 1, iat: Date.now(), ...data };
  const body = deflateRawSync(Buffer.from(JSON.stringify(payload))).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string): SessionData | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(inflateRawSync(Buffer.from(body, "base64url")).toString("utf8")) as SessionData;
    if (data.v !== 1 || Date.now() - data.iat > MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}
