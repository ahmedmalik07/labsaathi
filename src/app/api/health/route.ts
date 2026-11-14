import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { kb, reference } from "@/lib/kb";
import { configuredModels, llmStats, probeGroq } from "@/lib/llm/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const groq = await probeGroq();
  const models = configuredModels();
  const available = models.map((id) => ({ id, available: groq.models.includes(id) }));
  const llmUp = groq.reachable && available.some((m) => m.available);
  return NextResponse.json({
    status: llmUp ? "ok" : "degraded",
    message: llmUp
      ? "Rules engine and language model are both up."
      : "Language model is unavailable. Classifications still work and explanations use the built-in template.",
    engine: { status: "ok", strictNames: config.strictNames },
    llm: {
      provider: "groq",
      configured: Boolean(config.llm.apiKey),
      reachable: groq.reachable,
      probeLatencyMs: groq.latencyMs,
      error: groq.error,
      model: config.llm.model || null,
      fallbackModel: config.llm.fallbackModel || null,
      models: available,
      stats: {
        calls: llmStats.calls,
        cacheHits: llmStats.cacheHits,
        retries: llmStats.retries,
        fallbacks: llmStats.fallbacks,
        rateLimited: llmStats.rateLimited,
        failures: llmStats.failures,
        lastModel: llmStats.lastModel,
        lastLatencyMs: llmStats.lastLatencyMs,
        lastError: llmStats.lastError,
        remainingRequests: llmStats.remainingRequests,
        remainingTokens: llmStats.remainingTokens,
      },
    },
    knowledgeBase: {
      generatedAt: kb.generatedAt,
      files: kb.corpus.files.length,
      boilerplateRemovedPct: kb.corpus.removedPct,
      aliases: reference.aliases.length,
      ranges: reference.ranges.length,
      urgentThresholds: reference.urgent.length,
      rules: reference.rules.length,
    },
    time: new Date().toISOString(),
  });
}
