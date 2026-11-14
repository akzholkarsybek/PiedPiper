import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Upper bound for the configured model before trying the fallback model. */
const PRIMARY_ATTEMPT_MS = 25000;
const FALLBACK_NOTICE =
  "The configured Gemini model was not responding, so a supported fallback Gemini model handled this request.";
let primaryUnhealthyUntil = 0;
/** Per-call limits. Defaults preserve the Phase 1 behavior. */
export type GenerateOptions = {
  maxOutputTokens?: number;
  timeoutMs?: number;
  temperature?: number;
  /** Aborts the request when an orchestration-wide deadline is reached. */
  signal?: AbortSignal;
};
export type JSONGenerator = <T>(
  schema: z.ZodType<T>,
  systemInstruction: string,
  input: unknown,
  options?: GenerateOptions,
) => Promise<T & { providerNotice?: string }>;
export const generateJSON: JSONGenerator = async <T>(
  schema: z.ZodType<T>,
  systemInstruction: string,
  input: unknown,
  options: GenerateOptions = {},
): Promise<T & { providerNotice?: string }> => {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)
    throw new AIError(
      "NOT_CONFIGURED",
      "Gemini is not configured on this server. You can use the predefined demonstration.",
      503,
    );
  try {
    const timeout = options.timeoutMs ?? 35000;
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout },
    });
    let providerNotice: string | undefined;
    const primary = process.env.GEMINI_MODEL,
      fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
      canFallback = fallback !== primary;
    const request = (model: string, ms: number) =>
      client.models.generateContent({
        model,
        contents: JSON.stringify(input),
        config: {
          systemInstruction,
          temperature: options.temperature ?? 0.35,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          maxOutputTokens: options.maxOutputTokens ?? 5000,
          abortSignal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(ms)])
            : AbortSignal.timeout(ms),
        },
      });
    let result;
    if (canFallback && Date.now() < primaryUnhealthyUntil) {
      // Circuit breaker: the configured model recently timed out or returned
      // a server error, so go straight to the supported fallback for a while.
      result = await request(fallback, timeout);
      providerNotice = FALLBACK_NOTICE;
    } else
      try {
        result = await request(
          primary,
          canFallback ? Math.min(timeout, PRIMARY_ATTEMPT_MS) : timeout,
        );
      } catch (error) {
        if (options.signal?.aborted) throw error;
        const status = Number(
          (error as { status?: number; code?: number }).status ??
            (error as { code?: number }).code,
        );
        const transient =
          status >= 500 ||
          (error instanceof Error &&
            (error.name === "AbortError" || error.name === "TimeoutError"));
        if (!canFallback || (status !== 404 && !transient)) throw error;
        if (transient) primaryUnhealthyUntil = Date.now() + 5 * 60 * 1000;
        result = await request(fallback, timeout);
        providerNotice =
          status === 404
            ? "The configured model was unavailable. A supported fallback Gemini model handled this request."
            : FALLBACK_NOTICE;
      }
    const parsed = schema.safeParse(JSON.parse(result.text ?? ""));
    if (!parsed.success)
      throw new AIError(
        "INVALID_RESPONSE",
        "Gemini returned an incomplete or invalid response. Please retry, or use the predefined demonstration.",
        502,
      );
    return Object.assign(parsed.data as T & object, { providerNotice });
  } catch (error) {
    if (error instanceof AIError) throw error;
    const status = Number(
      (error as { status?: number; code?: number }).status ??
        (error as { code?: number }).code,
    );
    if (status === 429)
      throw new AIError(
        "RATE_LIMITED",
        "Gemini quota or rate limit reached. Wait a moment, or continue with the predefined demonstration.",
        429,
      );
    if (status === 400 || status === 401 || status === 403)
      throw new AIError(
        "CONFIGURATION_ERROR",
        "Gemini rejected the request. The server owner should check the API key, model access, and billing. The predefined demonstration is available.",
        503,
      );
    if (status === 404)
      throw new AIError(
        "MODEL_UNAVAILABLE",
        "The configured Gemini model is unavailable. Ask the server owner to check GEMINI_MODEL, or use the predefined demonstration.",
        503,
      );
    if (error instanceof SyntaxError)
      throw new AIError(
        "INVALID_JSON",
        "Gemini returned malformed JSON. No profile changes were saved. Please retry.",
        502,
      );
    throw new AIError(
      "NETWORK_ERROR",
      "Gemini could not be reached in time. Please retry, or use the predefined demonstration.",
      503,
    );
  }
};
