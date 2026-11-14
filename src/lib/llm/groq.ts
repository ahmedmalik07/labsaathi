/**
 * Groq client (OpenAI-compatible chat completions) with the reliability layer:
 *   - per-request timeout (AbortController)
 *   - exponential backoff with jitter on 429 and 5xx, honouring Retry-After
 *   - model fallback: GROQ_MODEL first, then GROQ_FALLBACK_MODEL
 *   - a concurrency gate so a burst of requests cannot blow the free-tier limit
 *   - a small in-memory cache keyed by a hash of the request
 *
 * It never throws. Callers get { ok: false } and fall back to templates, so the
 * app keeps returning classifications when the LLM is fully down.
 */
import { createHash } from "node:crypto";
import { config } from "../config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmAttempt {
  model: string;
  status: number | "timeout" | "network";
  waitedMs: number;
}

export type LlmResult =
  | { ok: true; json: unknown; model: string; usage: LlmUsage; latencyMs: number; attempts: LlmAttempt[]; cached: boolean }
  | { ok: false; error: string; attempts: LlmAttempt[]; latencyMs: number };

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Total time budget across retries and fallback. */
  deadlineMs?: number;
  /** Set to false to skip the cache (used by the retry-after-guard path). */
  cache?: boolean;
}

// ---- cache ------------------------------------------------------------------

interface CacheEntry {
  at: number;
  value: Extract<LlmResult, { ok: true }>;
}
const cache = new Map<string, CacheEntry>();

export function hashKey(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

function cacheGet(key: string): CacheEntry["value"] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > config.llm.cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  cache.delete(key); // refresh LRU position
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: CacheEntry["value"]): void {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > config.llm.cacheSize) cache.delete(cache.keys().next().value as string);
}

// ---- concurrency gate ---------------------------------------------------------

let active = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < config.llm.maxConcurrent) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
}

function release(): void {
  active--;
  waiting.shift()?.();
}

// ---- stats for /api/health ----------------------------------------------------

export const llmStats = {
  calls: 0,
  cacheHits: 0,
  retries: 0,
  fallbacks: 0,
  failures: 0,
  rateLimited: 0,
  lastModel: null as string | null,
  lastError: null as string | null,
  lastLatencyMs: null as number | null,
  remainingRequests: null as string | null,
  remainingTokens: null as string | null,
  /** Models that returned 429 recently are skipped until this time. */
  coolingUntil: {} as Record<string, number>,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parses "2", "1.5s", "1m26.4s" or "750ms" into milliseconds. */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000);
  let total = 0;
  let matched = false;
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) {
    matched = true;
    const n = Number(m[1]);
    total += m[2] === "ms" ? n : m[2] === "s" ? n * 1000 : m[2] === "m" ? n * 60_000 : n * 3_600_000;
  }
  return matched ? Math.round(total) : null;
}

export function backoffMs(attempt: number): number {
  const exp = config.llm.backoffBaseMs * 2 ** attempt;
  return Math.min(config.llm.backoffCapMs, Math.round(exp / 2 + Math.random() * (exp / 2)));
}

export function configuredModels(): string[] {
  return [...new Set([config.llm.model, config.llm.fallbackModel].filter(Boolean))];
}

export function llmConfigured(): boolean {
  return Boolean(config.llm.apiKey) && configuredModels().length > 0;
}

async function callOnce(model: string, opts: ChatOptions, timeoutMs: number): Promise<Response | "timeout" | "network"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.llm.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_completion_tokens: opts.maxTokens ?? 900,
        response_format: { type: "json_object" },
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
    });
  } catch (err) {
    return err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
  } finally {
    clearTimeout(timer);
  }
}

export async function chatJSON(opts: ChatOptions): Promise<LlmResult> {
  const started = Date.now();
  const attempts: LlmAttempt[] = [];
  const fail = (error: string): LlmResult => {
    llmStats.failures++;
    llmStats.lastError = error;
    return { ok: false, error, attempts, latencyMs: Date.now() - started };
  };

  if (!llmConfigured()) return fail("GROQ_API_KEY or GROQ_MODEL is not set");

  const key = hashKey(opts.messages, opts.maxTokens, opts.temperature);
  if (opts.cache !== false) {
    const hit = cacheGet(key);
    if (hit) {
      llmStats.cacheHits++;
      return { ...hit, cached: true, latencyMs: Date.now() - started };
    }
  }

  const deadline = started + (opts.deadlineMs ?? 22_000);
  const models = configuredModels();
  let lastError = "no attempt made";

  await acquire();
  try {
    for (let m = 0; m < models.length; m++) {
      const model = models[m];
      if (m > 0) llmStats.fallbacks++;
      if ((llmStats.coolingUntil[model] ?? 0) > Date.now() && m < models.length - 1) {
        lastError = `${model} is cooling down after a rate limit`;
        continue;
      }

      for (let attempt = 0; attempt <= config.llm.maxRetriesPerModel; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 1500) return fail(`time budget used up (${lastError})`);
        llmStats.calls++;
        const res = await callOnce(model, opts, Math.min(config.llm.timeoutMs, remaining));

        if (res === "timeout" || res === "network") {
          attempts.push({ model, status: res, waitedMs: 0 });
          lastError = `${model}: ${res}`;
          if (attempt < config.llm.maxRetriesPerModel) {
            const wait = backoffMs(attempt);
            llmStats.retries++;
            attempts[attempts.length - 1].waitedMs = wait;
            await sleep(wait);
            continue;
          }
          break;
        }

        llmStats.remainingRequests = res.headers.get("x-ratelimit-remaining-requests") ?? llmStats.remainingRequests;
        llmStats.remainingTokens = res.headers.get("x-ratelimit-remaining-tokens") ?? llmStats.remainingTokens;

        if (res.ok) {
          attempts.push({ model, status: res.status, waitedMs: 0 });
          try {
            const body = (await res.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            const content = body.choices?.[0]?.message?.content ?? "";
            const json = JSON.parse(content);
            const value: Extract<LlmResult, { ok: true }> = {
              ok: true,
              json,
              model,
              usage: {
                promptTokens: body.usage?.prompt_tokens ?? 0,
                completionTokens: body.usage?.completion_tokens ?? 0,
                totalTokens: body.usage?.total_tokens ?? 0,
              },
              latencyMs: Date.now() - started,
              attempts,
              cached: false,
            };
            llmStats.lastModel = model;
            llmStats.lastLatencyMs = value.latencyMs;
            llmStats.lastError = null;
            if (opts.cache !== false) cacheSet(key, value);
            return value;
          } catch {
            lastError = `${model}: reply was not valid JSON`;
            if (attempt < config.llm.maxRetriesPerModel) continue;
            break;
          }
        }

        attempts.push({ model, status: res.status, waitedMs: 0 });
        lastError = `${model}: HTTP ${res.status}`;

        if (res.status === 401 || res.status === 403) return fail(`${lastError} (check GROQ_API_KEY)`);

        const retryable = res.status === 429 || res.status >= 500 || res.status === 408;
        if (res.status === 429) llmStats.rateLimited++;
        if (!retryable) {
          // 400 json_validate_failed and similar: one more try on this model, then move on.
          if (res.status === 400 && attempt === 0) continue;
          break;
        }

        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        if (retryAfter !== null && retryAfter > config.llm.backoffCapMs) {
          // Waiting would cost more than the fallback model. Skip this model for a while.
          llmStats.coolingUntil[model] = Date.now() + Math.min(retryAfter, 60_000);
          break;
        }
        if (attempt < config.llm.maxRetriesPerModel) {
          const wait = Math.max(retryAfter ?? 0, backoffMs(attempt));
          if (Date.now() + wait > deadline - 1500) break;
          llmStats.retries++;
          attempts[attempts.length - 1].waitedMs = wait;
          await sleep(wait);
        }
      }
    }
  } finally {
    release();
  }

  return fail(lastError);
}

/** Lightweight reachability probe for /api/health. Cached for 60 seconds. */
let healthCache: { at: number; value: { reachable: boolean; latencyMs: number | null; models: string[]; error: string | null } } | null = null;

export async function probeGroq() {
  if (healthCache && Date.now() - healthCache.at < 60_000) return healthCache.value;
  const started = Date.now();
  let value: NonNullable<typeof healthCache>["value"];
  if (!config.llm.apiKey) {
    value = { reachable: false, latencyMs: null, models: [], error: "GROQ_API_KEY is not set" };
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${config.llm.baseUrl}/models`, { headers: { Authorization: `Bearer ${config.llm.apiKey}` }, signal: controller.signal });
      if (res.ok) {
        const body = (await res.json()) as { data?: Array<{ id: string }> };
        value = { reachable: true, latencyMs: Date.now() - started, models: (body.data ?? []).map((m) => m.id), error: null };
      } else {
        value = { reachable: false, latencyMs: Date.now() - started, models: [], error: `HTTP ${res.status}` };
      }
    } catch (err) {
      value = { reachable: false, latencyMs: null, models: [], error: err instanceof Error ? err.name : "network error" };
    } finally {
      clearTimeout(timer);
    }
  }
  healthCache = { at: Date.now(), value };
  return value;
}
