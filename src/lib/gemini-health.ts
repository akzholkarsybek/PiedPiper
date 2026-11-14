/**
 * Gemini error classification and short-lived, server-side health state.
 *
 * Every provider failure is mapped to ONE category so the app can react
 * appropriately (retry, cool down, fall back, or stop). State lives in this
 * server process only: it is deliberately short-lived, holds no request
 * payloads, profile data, or secrets, and resets on restart. On a multi-
 * instance deployment each instance keeps its own view, which is acceptable
 * because every entry expires within minutes to hours.
 */
export const errorCategories = [
  "not-configured",
  "auth",
  "bad-request",
  "model-unavailable",
  "rate-limited",
  "daily-quota",
  "server-error",
  "timeout",
  "network",
  "invalid-response",
] as const;
export type ErrorCategory = (typeof errorCategories)[number];

export type Classified = {
  category: ErrorCategory;
  status: number | null;
  /** Provider-suggested wait (RetryInfo / "retry in Ns"), when present. */
  retryAfterMs: number | null;
  /** For quota errors: does the limit apply to one model or the whole project? */
  quotaScope: "model" | "project" | null;
};

/** A 429 asking to wait longer than this is treated as quota exhaustion. */
const LONG_WAIT_MS = 15 * 60 * 1000;

function parseDuration(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(text.trim());
  return m ? Math.round(Number(m[1]) * 1000) : null;
}
type Detail = {
  "@type"?: string;
  retryDelay?: string;
  violations?: { quotaId?: string; quotaMetric?: string }[];
};
function detailsOf(error: unknown): Detail[] {
  const message = error instanceof Error ? error.message : String(error ?? "");
  // The SDK puts the provider's JSON error body in `message`.
  const start = message.indexOf("{");
  if (start < 0) return [];
  try {
    const body = JSON.parse(message.slice(start)) as {
      error?: { details?: Detail[] };
    };
    return Array.isArray(body.error?.details) ? body.error.details : [];
  } catch {
    return [];
  }
}

/** Map any thrown provider error to a category. Never returns raw text. */
export function classifyGeminiError(error: unknown): Classified {
  const e = error as {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    cause?: { code?: unknown };
  };
  const rawStatus = Number(e?.status ?? e?.code);
  const status =
    Number.isFinite(rawStatus) && rawStatus >= 100 ? rawStatus : null;
  const message = error instanceof Error ? error.message : "";
  const details = detailsOf(error);
  let retryAfterMs: number | null = null;
  for (const d of details)
    if (d["@type"]?.endsWith("RetryInfo") && d.retryDelay)
      retryAfterMs = parseDuration(d.retryDelay);
  if (retryAfterMs === null) {
    const m = /retry in (\d+(?:\.\d+)?)\s?s/i.exec(message);
    if (m) retryAfterMs = Math.round(Number(m[1]) * 1000);
  }
  const quotaIds = details.flatMap((d) =>
    (d.violations ?? []).map(
      (v) => `${v.quotaId ?? ""} ${v.quotaMetric ?? ""}`,
    ),
  );
  const base = { status, retryAfterMs, quotaScope: null };
  if (status === 429) {
    const daily =
      quotaIds.some((q) => /per\s?day/i.test(q)) ||
      /per day|daily/i.test(message) ||
      (retryAfterMs !== null && retryAfterMs > LONG_WAIT_MS);
    const scope: Classified["quotaScope"] = quotaIds.length
      ? quotaIds.every((q) => /permodel/i.test(q))
        ? "model"
        : "project"
      : "model";
    return {
      ...base,
      category: daily ? "daily-quota" : "rate-limited",
      quotaScope: scope,
    };
  }
  if (status === 401 || status === 403) return { ...base, category: "auth" };
  if (status === 400)
    return {
      ...base,
      // An invalid key is reported as 400 by the Gemini API.
      category: /api key|api_key|permission/i.test(message)
        ? "auth"
        : "bad-request",
    };
  if (status === 404) return { ...base, category: "model-unavailable" };
  if (status === 504 || status === 408) return { ...base, category: "timeout" };
  if (status !== null && status >= 500)
    return { ...base, category: "server-error" };
  const name = typeof e?.name === "string" ? e.name : "";
  if (name === "AbortError" || name === "TimeoutError")
    return { ...base, category: "timeout" };
  if (error instanceof SyntaxError)
    return { ...base, category: "invalid-response" };
  const code = String(e?.cause?.code ?? e?.code ?? "");
  if (
    /fetch failed|network|socket|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(
      `${message} ${code}`,
    ) ||
    error instanceof TypeError
  )
    return { ...base, category: "network" };
  return { ...base, category: "network" };
}

// ---------- Short-lived health state ----------
type ModelState = {
  cooldownUntil: number;
  reason: ErrorCategory | null;
  lastOkAt: number | null;
};
type HealthState = {
  models: Map<string, ModelState>;
  project: { cooldownUntil: number; reason: ErrorCategory | null };
  lastError: { category: ErrorCategory; at: number; model: string } | null;
  lastSuccess: { at: number; model: string } | null;
  lastFallbackAt: number | null;
  lastLiveCheckAt: number | null;
};
const fresh = (): HealthState => ({
  models: new Map(),
  project: { cooldownUntil: 0, reason: null },
  lastError: null,
  lastSuccess: null,
  lastFallbackAt: null,
  lastLiveCheckAt: null,
});
let health = fresh();
let clock: () => number = () => Date.now();

/** Tests only. */
export function resetGeminiHealth(now?: () => number) {
  health = fresh();
  clock = now ?? (() => Date.now());
}
export const healthNow = () => clock();

/** How long each category keeps a model (or the project) out of rotation. */
export function cooldownFor(c: Classified): number {
  switch (c.category) {
    case "daily-quota":
      // Respect the provider's delay; otherwise wait an hour before trying again.
      return Math.min(c.retryAfterMs ?? 60 * 60 * 1000, 24 * 60 * 60 * 1000);
    case "rate-limited":
      return Math.min(Math.max(c.retryAfterMs ?? 20000, 5000), LONG_WAIT_MS);
    case "model-unavailable":
      return 60 * 60 * 1000;
    case "server-error":
    case "timeout":
      return 3 * 60 * 1000;
    case "auth":
      return 10 * 60 * 1000;
    case "network":
      return 30 * 1000;
    default:
      return 0;
  }
}
/** Categories that affect every model, so switching models cannot help. */
export function isProjectWide(c: Classified) {
  return (
    c.category === "auth" ||
    c.category === "network" ||
    (c.category === "daily-quota" && c.quotaScope === "project") ||
    (c.category === "rate-limited" && c.quotaScope === "project")
  );
}
export function recordFailure(model: string, c: Classified) {
  const now = clock();
  health.lastError = { category: c.category, at: now, model };
  const until = now + cooldownFor(c);
  if (until <= now) return;
  if (isProjectWide(c)) {
    if (until > health.project.cooldownUntil)
      health.project = { cooldownUntil: until, reason: c.category };
    return;
  }
  const s = health.models.get(model) ?? {
    cooldownUntil: 0,
    reason: null,
    lastOkAt: null,
  };
  if (until > s.cooldownUntil) {
    s.cooldownUntil = until;
    s.reason = c.category;
  }
  health.models.set(model, s);
}
export function recordSuccess(model: string, viaFallback: boolean) {
  const now = clock();
  const s = health.models.get(model) ?? {
    cooldownUntil: 0,
    reason: null,
    lastOkAt: null,
  };
  s.lastOkAt = now;
  s.cooldownUntil = 0;
  s.reason = null;
  health.models.set(model, s);
  health.lastSuccess = { at: now, model };
  if (viaFallback) health.lastFallbackAt = now;
}
export function projectCooldown() {
  return health.project.cooldownUntil > clock() ? health.project : null;
}
export function modelCooldown(model: string) {
  const s = health.models.get(model);
  return s && s.cooldownUntil > clock() ? s : null;
}
export function markLiveCheck() {
  health.lastLiveCheckAt = clock();
}
export function lastLiveCheckAt() {
  return health.lastLiveCheckAt;
}

export type GeminiStatus = {
  configured: boolean;
  model: string | null;
  fallbackModel: string | null;
  /** available: last call worked · degraded: primary cooling down, fallback usable · unavailable: no model usable right now · unknown: no calls yet */
  availability:
    "available" | "degraded" | "unavailable" | "unknown" | "not-configured";
  lastErrorCategory: ErrorCategory | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  fallbackActive: boolean;
  /** When live AI is unavailable the app offers the scripted demonstration. */
  scriptedRecommended: boolean;
  retryAt: string | null;
  models: {
    name: string;
    role: "primary" | "fallback";
    state: "ready" | "cooling-down";
    reason: ErrorCategory | null;
    until: string | null;
  }[];
};
export function modelChain() {
  const primary = process.env.GEMINI_MODEL?.trim() || null;
  const fb = process.env.GEMINI_FALLBACK_MODEL?.trim();
  // An explicit "none" disables the fallback model entirely.
  // Free-tier quotas are per model, so a different model is a real fallback.
  const fallback =
    fb === "none"
      ? null
      : fb ||
        (primary === "gemini-3.5-flash-lite"
          ? "gemini-3.5-flash"
          : primary
            ? "gemini-3.5-flash-lite"
            : null);
  return {
    primary,
    fallback: fallback && fallback !== primary ? fallback : null,
  };
}
const iso = (ms: number | null | undefined) =>
  ms ? new Date(ms).toISOString() : null;
/** A non-sensitive snapshot for the developer diagnostics panel. */
export function geminiStatus(): GeminiStatus {
  const { primary, fallback } = modelChain();
  const configured = !!process.env.GEMINI_API_KEY && !!primary;
  const now = clock();
  const project = projectCooldown();
  const models = [
    ...(primary ? [{ name: primary, role: "primary" as const }] : []),
    ...(fallback ? [{ name: fallback, role: "fallback" as const }] : []),
  ].map((m) => {
    const cd = modelCooldown(m.name);
    const until = project?.cooldownUntil ?? cd?.cooldownUntil ?? null;
    return {
      ...m,
      state:
        until && until > now ? ("cooling-down" as const) : ("ready" as const),
      reason: project?.reason ?? cd?.reason ?? null,
      until: iso(until),
    };
  });
  const ready = models.filter((m) => m.state === "ready");
  const availability: GeminiStatus["availability"] = !configured
    ? "not-configured"
    : !ready.length
      ? "unavailable"
      : ready[0].role === "fallback"
        ? "degraded"
        : !health.lastSuccess && !health.lastError
          ? "unknown"
          : "available";
  const soonest = models
    .map((m) => (m.until ? Date.parse(m.until) : null))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b)[0];
  return {
    configured,
    model: primary,
    fallbackModel: fallback,
    availability,
    lastErrorCategory: health.lastError?.category ?? null,
    lastErrorAt: iso(health.lastError?.at),
    lastSuccessAt: iso(health.lastSuccess?.at),
    fallbackActive:
      availability === "degraded" ||
      (!!health.lastFallbackAt &&
        health.lastFallbackAt === health.lastSuccess?.at),
    scriptedRecommended:
      availability === "unavailable" || availability === "not-configured",
    retryAt: availability === "unavailable" ? iso(soonest ?? null) : null,
    models,
  };
}
