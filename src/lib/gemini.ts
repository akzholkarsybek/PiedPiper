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
export async function generateJSON<T>(
  schema: z.ZodType<T>,
  systemInstruction: string,
  input: unknown,
): Promise<T & { providerNotice?: string }> {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)
    throw new AIError(
      "NOT_CONFIGURED",
      "Gemini is not configured on this server. You can use the predefined demonstration.",
      503,
    );
  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 35000 },
    });
    let providerNotice: string | undefined;
    const request = (model: string) =>
      client.models.generateContent({
        model,
        contents: JSON.stringify(input),
        config: {
          systemInstruction,
          temperature: 0.35,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          maxOutputTokens: 5000,
        },
      });
    let result;
    try {
      result = await request(process.env.GEMINI_MODEL);
    } catch (error) {
      const status = Number(
        (error as { status?: number; code?: number }).status ??
          (error as { code?: number }).code,
      );
      if (status !== 404) throw error;
      result = await request(
        process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
      );
      providerNotice =
        "The configured model was unavailable. A supported fallback Gemini model handled this request.";
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
}
