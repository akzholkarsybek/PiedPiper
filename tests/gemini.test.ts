import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AIError,
  generateJSON,
  setGeminiClientFactory,
} from "../src/lib/gemini";
import {
  classifyGeminiError,
  geminiStatus,
  modelChain,
  resetGeminiHealth,
} from "../src/lib/gemini-health";

const KEY = "test-key-DO-NOT-LEAK-123";
const schema = z.object({ ok: z.boolean() });
/** An SDK-shaped error carrying the provider's JSON body, like ApiError. */
function apiError(status: number, details: unknown[] = [], message = "") {
  const e = new Error(
    JSON.stringify({ error: { code: status, message, details } }),
  ) as Error & { status: number };
  e.name = "ApiError";
  e.status = status;
  return e;
}
const dailyQuota = (scope: "model" | "project" = "model") =>
  apiError(429, [
    {
      "@type": "type.googleapis.com/google.rpc.QuotaFailure",
      violations: [
        {
          quotaMetric:
            "generativelanguage.googleapis.com/generate_content_free_tier_requests",
          quotaId:
            scope === "model"
              ? "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
              : "GenerateRequestsPerDayPerProject-FreeTier",
        },
      ],
    },
    {
      "@type": "type.googleapis.com/google.rpc.RetryInfo",
      retryDelay: "60609s",
    },
  ]);
const shortLimit = (delay = "0.01s") =>
  apiError(429, [
    {
      "@type": "type.googleapis.com/google.rpc.QuotaFailure",
      violations: [
        { quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" },
      ],
    },
    { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay },
  ]);
const timeout = () => {
  const e = new Error("This operation was aborted");
  e.name = "AbortError";
  return e;
};

type Step = Error | string;
/** Fake SDK: each model answers from its own script; records every request. */
function fakeClient(scripts: Record<string, Step[]>) {
  const requests: string[] = [];
  setGeminiClientFactory(
    () =>
      ({
        models: {
          generateContent: async ({ model }: { model: string }) => {
            requests.push(model);
            const step = scripts[model]?.shift() ?? '{"ok":true}';
            if (step instanceof Error) throw step;
            return { text: step };
          },
        },
      }) as never,
  );
  return requests;
}
const call = (extra = {}) =>
  generateJSON(schema, "sys", { x: 1 }, { backoffBaseMs: 0, ...extra });

beforeEach(() => {
  process.env.GEMINI_API_KEY = KEY;
  process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash";
  resetGeminiHealth();
});
afterEach(() => setGeminiClientFactory(null));

describe("Model configuration", () => {
  it("reads the preferred and fallback models from the environment", () => {
    expect(modelChain()).toEqual({
      primary: "gemini-3.5-flash-lite",
      fallback: "gemini-3.5-flash",
    });
    process.env.GEMINI_FALLBACK_MODEL = "none";
    expect(modelChain().fallback).toBeNull();
    process.env.GEMINI_FALLBACK_MODEL = "";
    expect(modelChain().fallback).toBe("gemini-3.5-flash");
    process.env.GEMINI_MODEL = "gemini-3.8-flash";
    expect(modelChain().fallback).toBe("gemini-3.5-flash-lite");
    process.env.GEMINI_FALLBACK_MODEL = "gemini-3.8-flash";
    expect(modelChain().fallback).toBeNull(); // never "falls back" to itself
  });
  it("fails without a request when Gemini isn't configured", async () => {
    const requests = fakeClient({});
    delete process.env.GEMINI_API_KEY;
    await expect(call()).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(requests).toEqual([]);
  });
  it("uses the preferred model when it works", async () => {
    const requests = fakeClient({});
    const r = await call();
    expect(r.ok).toBe(true);
    expect(r.providerModel).toBe("gemini-3.5-flash-lite");
    expect(r.providerNotice).toBeUndefined();
    expect(requests).toEqual(["gemini-3.5-flash-lite"]);
  });
});

describe("Error classification", () => {
  it("distinguishes every failure category", () => {
    expect(classifyGeminiError(apiError(401)).category).toBe("auth");
    expect(classifyGeminiError(apiError(403)).category).toBe("auth");
    expect(
      classifyGeminiError(apiError(400, [], "API key not valid")).category,
    ).toBe("auth");
    expect(classifyGeminiError(apiError(404)).category).toBe(
      "model-unavailable",
    );
    expect(classifyGeminiError(shortLimit("20s"))).toMatchObject({
      category: "rate-limited",
      retryAfterMs: 20000,
      quotaScope: "model",
    });
    expect(classifyGeminiError(dailyQuota())).toMatchObject({
      category: "daily-quota",
      quotaScope: "model",
      retryAfterMs: 60609000,
    });
    expect(classifyGeminiError(dailyQuota("project")).quotaScope).toBe(
      "project",
    );
    expect(classifyGeminiError(apiError(500)).category).toBe("server-error");
    expect(classifyGeminiError(apiError(503)).category).toBe("server-error");
    expect(classifyGeminiError(apiError(504)).category).toBe("timeout");
    expect(classifyGeminiError(timeout()).category).toBe("timeout");
    expect(classifyGeminiError(new TypeError("fetch failed")).category).toBe(
      "network",
    );
  });
});

describe("Quota handling, retries and fallback", () => {
  it("does not retry after daily quota exhaustion and tries the fallback once (per-model quota)", async () => {
    const requests = fakeClient({ "gemini-3.5-flash-lite": [dailyQuota()] });
    const r = await call();
    expect(requests).toEqual(["gemini-3.5-flash-lite", "gemini-3.5-flash"]);
    expect(r.providerModel).toBe("gemini-3.5-flash");
    expect(r.providerNotice).toMatch(/fallback/);
    // The exhausted model is skipped entirely afterwards: no retry storm.
    await call();
    expect(requests.filter((m) => m === "gemini-3.5-flash-lite")).toHaveLength(
      1,
    );
  });
  it("stops everything when the quota is project-wide, without switching models", async () => {
    const requests = fakeClient({
      "gemini-3.5-flash-lite": [dailyQuota("project")],
    });
    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(AIError);
    expect(error.code).toBe("DAILY_QUOTA");
    expect(error.message).toMatch(/daily free-tier quota/);
    expect(error.message).toMatch(/resets in about 17 h/);
    expect(requests).toEqual(["gemini-3.5-flash-lite"]);
    // Later calls fail fast with no request at all.
    await expect(call()).rejects.toMatchObject({ code: "DAILY_QUOTA" });
    expect(requests).toHaveLength(1);
    expect(geminiStatus().availability).toBe("unavailable");
    expect(geminiStatus().scriptedRecommended).toBe(true);
  });
  it("retries a short rate limit with backoff, honoring the provider's delay", async () => {
    const requests = fakeClient({
      "gemini-3.5-flash-lite": [shortLimit("0.02s"), shortLimit("0.02s")],
    });
    const started = Date.now();
    const r = await call();
    expect(r.providerModel).toBe("gemini-3.5-flash-lite");
    expect(requests).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
    ]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });
  it("does not wait for long Retry-After delays; it cools the model down and moves on", async () => {
    const requests = fakeClient({
      "gemini-3.5-flash-lite": [shortLimit("45s")],
    });
    const started = Date.now();
    const r = await call();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(requests).toEqual(["gemini-3.5-flash-lite", "gemini-3.5-flash"]);
    expect(r.providerModel).toBe("gemini-3.5-flash");
  });
  it("retries a 504 timeout once, then uses the fallback and opens the circuit", async () => {
    const requests = fakeClient({
      "gemini-3.5-flash-lite": [apiError(504), timeout()],
    });
    const r = await call();
    expect(requests).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
    ]);
    expect(r.providerModel).toBe("gemini-3.5-flash");
    await call(); // circuit open: straight to the fallback
    expect(requests.at(-1)).toBe("gemini-3.5-flash");
    expect(geminiStatus().availability).toBe("degraded");
    expect(geminiStatus().lastErrorCategory).toBe("timeout");
  });
  it("bounds the total number of requests per call", async () => {
    const requests = fakeClient({
      "gemini-3.5-flash-lite": [apiError(503), apiError(503), apiError(503)],
      "gemini-3.5-flash": [apiError(503), apiError(503), apiError(503)],
    });
    await expect(call({ maxRequests: 4 })).rejects.toMatchObject({
      code: "SERVER_ERROR",
    });
    expect(requests.length).toBe(4);
  });
  it("never retries or switches models after an authentication error", async () => {
    const requests = fakeClient({ "gemini-3.5-flash-lite": [apiError(403)] });
    await expect(call()).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
    expect(requests).toEqual(["gemini-3.5-flash-lite"]);
  });
  it("falls back once on 404 and remembers that the model is unavailable", async () => {
    const requests = fakeClient({ "gemini-3.5-flash-lite": [apiError(404)] });
    await call();
    await call();
    expect(requests).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.5-flash",
    ]);
  });
  it("does not retry or blame the provider for malformed JSON", async () => {
    const requests = fakeClient({ "gemini-3.5-flash-lite": ["not json"] });
    await expect(call()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(requests).toHaveLength(1);
    expect(geminiStatus().availability).not.toBe("unavailable");
  });
  it("counts every HTTP request through onRequest", async () => {
    fakeClient({ "gemini-3.5-flash-lite": [shortLimit("0.01s")] });
    const seen: string[] = [];
    await call({ onRequest: (m: string) => seen.push(m) });
    expect(seen).toHaveLength(2);
  });
});

describe("Diagnostics never expose secrets", () => {
  it("reports models and categories only", async () => {
    fakeClient({ "gemini-3.5-flash-lite": [dailyQuota()] });
    await call();
    const text = JSON.stringify(geminiStatus());
    expect(text).not.toContain(KEY);
    expect(text).not.toMatch(/generate_content_free_tier|quotaId|"x":1/);
    expect(geminiStatus()).toMatchObject({
      configured: true,
      model: "gemini-3.5-flash-lite",
      fallbackModel: "gemini-3.5-flash",
      lastErrorCategory: "daily-quota",
      availability: "degraded",
    });
  });
  it("user-facing errors never include provider text", async () => {
    fakeClient({
      "gemini-3.5-flash-lite": [apiError(403, [], `bad key ${KEY}`)],
    });
    const e = await call().catch((x) => x);
    expect(e.message).not.toContain(KEY);
    expect(e.message).not.toMatch(/bad key/);
  });
});
