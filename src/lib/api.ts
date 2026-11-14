/** Shared helpers for the route handlers: clean error JSON and a small per-IP rate limiter. */
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export function errorJson(status: number, code: string, message: string, details?: unknown, headers?: Record<string, string>) {
  const body: ApiError = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status, headers });
}

export function zodError(err: ZodError) {
  return errorJson(
    400,
    "invalid_request",
    "The request body is not valid.",
    err.issues.map((i) => ({ field: i.path.join(".") || "(body)", problem: i.message })),
  );
}

// ---- rate limiter (fixed window, in memory, per IP) -----------------------------

const windows = new Map<string, { start: number; count: number }>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") || "local").trim();
}

/** Returns null when allowed, or a 429 response with Retry-After. */
export function rateLimit(req: Request, bucket: string, perMinute: number) {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) {
      for (const [k, v] of windows) if (now - v.start >= 60_000) windows.delete(k);
    }
    return null;
  }
  w.count++;
  if (w.count <= perMinute) return null;
  const retryAfter = Math.max(1, Math.ceil((w.start + 60_000 - now) / 1000));
  return errorJson(429, "rate_limited", `Too many requests. Try again in ${retryAfter} seconds.`, { limitPerMinute: perMinute }, { "Retry-After": String(retryAfter) });
}

/** Reads JSON, or treats a text/markdown body as the report itself. */
export async function readBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const type = req.headers.get("content-type") ?? "";
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, response: errorJson(400, "unreadable_body", "The request body could not be read.") };
  }
  if (!raw.trim()) return { ok: false, response: errorJson(400, "empty_body", "The request body is empty.") };
  if (type.includes("text/plain") || type.includes("text/markdown")) return { ok: true, body: { reportText: raw } };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, response: errorJson(400, "invalid_json", "The request body is not valid JSON.") };
  }
}
