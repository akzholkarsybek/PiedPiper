import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  classifyGeminiError,
  modelChain,
  modelCooldown,
  projectCooldown,
  recordFailure,
  recordSuccess,
  type Classified,
  type ErrorCategory,
} from "./gemini-health";

export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public category: ErrorCategory | null = null,
    public retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}
/** Upper bound for the primary model before trying the fallback model. */
const PRIMARY_ATTEMPT_MS = 25000;
/** Never wait longer than this for a retry inside one request. */
const MAX_RETRY_WAIT_MS = 10000;
const DEFAULT_MAX_REQUESTS = 4;

export type GenerateOptions = {
  maxOutputTokens?: number;
  timeoutMs?: number;
  temperature?: number;
  /** Aborts the request when an orchestration-wide deadline is reached. */
  signal?: AbortSignal;
  /** Total HTTP requests allowed for this call, across retries and models. */
  maxRequests?: number;
  /** Absolute time (ms) after which no retry may be started. */
  deadlineAt?: number;
  /** Called once per HTTP request actually sent (for call accounting). */
  onRequest?: (model: string) => void;
  /** Base delay for exponential backoff (tests use 0). */
  backoffBaseMs?: number;
  /** Optional user-owned images (already consented to) sent with the text. */
  media?: { mimeType: string; data: string }[];
};
export type GenerateResult<T> = T & {
  providerNotice?: string;
  providerModel?: string;
};
export type JSONGenerator = <T>(
  schema: z.ZodType<T>,
  systemInstruction: string,
  input: unknown,
  options?: GenerateOptions,
) => Promise<GenerateResult<T>>;

type Client = Pick<GoogleGenAI, "models">;
let clientFactory: (apiKey: string) => Client = (apiKey) =>
  new GoogleGenAI({ apiKey });
/** Tests only: replace the SDK client with a fake. */
export function setGeminiClientFactory(f: ((apiKey: string) => Client) | null) {
  clientFactory = f ?? ((apiKey) => new GoogleGenAI({ apiKey }));
}

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60000));
/** User-safe message per category. Never contains provider text or secrets. */
export function aiErrorFor(c: Classified, until?: number): AIError {
  const wait = until ? until - Date.now() : (c.retryAfterMs ?? 0);
  switch (c.category) {
    case "daily-quota":
      return new AIError(
        "DAILY_QUOTA",
        `Gemini's daily free-tier quota is used up${wait > 0 ? ` (resets in about ${wait > 90 * 60000 ? `${Math.round(wait / 3600000)} h` : `${minutes(wait)} min`})` : ""}. Live AI is paused, so nothing will be retried until then. The scripted demonstration works without it.`,
        429,
        c.category,
        wait > 0 ? wait : null,
      );
    case "rate-limited":
      return new AIError(
        "RATE_LIMITED",
        `Gemini is receiving too many requests right now. Try again in about ${Math.max(5, Math.round(wait / 1000) || 20)} seconds, or continue with the scripted demonstration.`,
        429,
        c.category,
        wait > 0 ? wait : null,
      );
    case "auth":
      return new AIError(
        "CONFIGURATION_ERROR",
        "Gemini rejected this server's credentials. The server owner should check the API key and model access. The scripted demonstration is available.",
        503,
        c.category,
      );
    case "bad-request":
      return new AIError(
        "BAD_REQUEST",
        "Gemini could not process this request. Please retry, or use the scripted demonstration.",
        502,
        c.category,
      );
    case "model-unavailable":
      return new AIError(
        "MODEL_UNAVAILABLE",
        "The configured Gemini model is unavailable to this project. Ask the server owner to check GEMINI_MODEL, or use the scripted demonstration.",
        503,
        c.category,
      );
    case "server-error":
      return new AIError(
        "SERVER_ERROR",
        "Gemini had a temporary server problem. Please retry shortly, or use the scripted demonstration.",
        503,
        c.category,
      );
    case "timeout":
      return new AIError(
        "TIMEOUT",
        "Gemini did not respond in time. Please retry shortly, or use the scripted demonstration.",
        504,
        c.category,
      );
    case "invalid-response":
      return new AIError(
        "INVALID_RESPONSE",
        "Gemini returned an incomplete or invalid response. Nothing was saved. Please retry, or use the scripted demonstration.",
        502,
        c.category,
      );
    case "not-configured":
      return new AIError(
        "NOT_CONFIGURED",
        "Gemini is not configured on this server. You can use the scripted demonstration.",
        503,
        c.category,
      );
    default:
      return new AIError(
        "NETWORK_ERROR",
        "Gemini could not be reached. Please retry, or use the scripted demonstration.",
        503,
        c.category,
      );
  }
}
const retryable = (c: ErrorCategory) =>
  c === "rate-limited" ||
  c === "server-error" ||
  c === "timeout" ||
  c === "network";
/** Categories after which a different model may still succeed. */
const tryNextModel = (c: Classified) =>
  c.category === "model-unavailable" ||
  c.category === "server-error" ||
  c.category === "timeout" ||
  ((c.category === "daily-quota" || c.category === "rate-limited") &&
    c.quotaScope === "model");

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
class InvalidResponse extends Error {}

/**
 * One structured-JSON Gemini call with bounded, category-aware recovery:
 * - 429 short rate limit / 5xx / 504 / network: bounded exponential backoff,
 *   honoring the provider's retry delay when it is short enough.
 * - 429 daily quota: no retries; the model (or project) cools down until the
 *   provider's reset time, and later calls fail fast without a request.
 * - 404: the model is marked unavailable; the fallback is tried.
 * - 401/403: never retried, never switches models.
 * A fallback model is only tried when it is not itself cooling down and the
 * failure was specific to the primary model.
 */
export const generateJSON: JSONGenerator = async <T>(
  schema: z.ZodType<T>,
  systemInstruction: string,
  input: unknown,
  options: GenerateOptions = {},
): Promise<GenerateResult<T>> => {
  const { primary, fallback } = modelChain();
  if (!process.env.GEMINI_API_KEY || !primary)
    throw aiErrorFor({
      category: "not-configured",
      status: null,
      retryAfterMs: null,
      quotaScope: null,
    });
  const project = projectCooldown();
  if (project)
    throw aiErrorFor(
      {
        category: project.reason ?? "network",
        status: null,
        retryAfterMs: null,
        quotaScope: "project",
      },
      project.cooldownUntil,
    );
  const client = clientFactory(process.env.GEMINI_API_KEY);
  const timeout = options.timeoutMs ?? 35000;
  const maxRequests = Math.max(1, options.maxRequests ?? DEFAULT_MAX_REQUESTS);
  const base = options.backoffBaseMs ?? 1000;
  const jsonSchema = z.toJSONSchema(schema);
  const text = JSON.stringify(input);
  const contents = options.media?.length
    ? [
        {
          role: "user",
          parts: [
            { text },
            ...options.media.map((m) => ({
              inlineData: { mimeType: m.mimeType, data: m.data },
            })),
          ],
        },
      ]
    : text;
  const chain = [primary, ...(fallback ? [fallback] : [])];
  let sent = 0;
  let last: { c: Classified; until?: number } | null = null;
  for (const [index, model] of chain.entries()) {
    const cooling = modelCooldown(model);
    if (cooling) {
      last = {
        c: {
          category: cooling.reason ?? "server-error",
          status: null,
          retryAfterMs: null,
          quotaScope: "model",
        },
        until: cooling.cooldownUntil,
      };
      continue; // fail fast: no request to a model that is cooling down
    }
    const isFallback = index > 0;
    const perAttempt =
      !isFallback && fallback ? Math.min(timeout, PRIMARY_ATTEMPT_MS) : timeout;
    for (let attempt = 0; sent < maxRequests; attempt++) {
      if (options.signal?.aborted)
        throw new AIError("ABORTED", "The request was cancelled.", 499);
      sent++;
      options.onRequest?.(model);
      try {
        const result = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            maxOutputTokens: options.maxOutputTokens ?? 5000,
            abortSignal: options.signal
              ? AbortSignal.any([
                  options.signal,
                  AbortSignal.timeout(perAttempt),
                ])
              : AbortSignal.timeout(perAttempt),
          },
        });
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(result.text ?? "");
        } catch {
          throw new InvalidResponse();
        }
        const parsed = schema.safeParse(parsedJson);
        if (!parsed.success) throw new InvalidResponse();
        recordSuccess(model, isFallback);
        return Object.assign(parsed.data as T & object, {
          providerModel: model,
          providerNotice: isFallback
            ? "The preferred Gemini model was unavailable, so the configured fallback model handled this request."
            : undefined,
        });
      } catch (error) {
        if (options.signal?.aborted)
          throw new AIError("ABORTED", "The request was cancelled.", 499);
        if (error instanceof InvalidResponse)
          // A malformed answer is not a provider outage: don't retry or cool down.
          throw aiErrorFor({
            category: "invalid-response",
            status: null,
            retryAfterMs: null,
            quotaScope: null,
          });
        const c = classifyGeminiError(error);
        last = { c };
        const backoff =
          base * 2 ** attempt + (base ? Math.floor(Math.random() * 250) : 0);
        const wait = Math.max(backoff, c.retryAfterMs ?? 0);
        const withinDeadline =
          !options.deadlineAt || Date.now() + wait + 2000 < options.deadlineAt;
        // Timeouts are slow, so they get one retry at most.
        const attemptsFor = c.category === "timeout" ? 1 : 2;
        if (
          retryable(c.category) &&
          attempt < attemptsFor &&
          sent < maxRequests &&
          wait <= MAX_RETRY_WAIT_MS &&
          withinDeadline
        ) {
          await sleep(wait, options.signal);
          continue;
        }
        recordFailure(model, c);
        if (!tryNextModel(c)) throw aiErrorFor(c);
        break; // move on to the fallback model, if any
      }
    }
    if (sent >= maxRequests) break;
  }
  throw aiErrorFor(
    last?.c ?? {
      category: "network",
      status: null,
      retryAfterMs: null,
      quotaScope: null,
    },
    last?.until,
  );
};
