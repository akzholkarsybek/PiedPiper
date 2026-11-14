import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, guardedBody } from "@/lib/api-guard";
import { AIError, generateJSON } from "@/lib/gemini";
import {
  geminiStatus,
  lastLiveCheckAt,
  markLiveCheck,
} from "@/lib/gemini-health";

export const runtime = "nodejs";
export const maxDuration = 45;

const headers = { "Cache-Control": "no-store" };
/** Minimum spacing between developer-triggered live checks (protects quota). */
const CHECK_INTERVAL_MS = 60000;

/**
 * Non-sensitive Gemini diagnostics: model names, availability, last error
 * CATEGORY, cooldowns and whether fallback/scripted mode applies. Never
 * includes keys, raw provider messages, request payloads, or profile data.
 * GET never contacts Gemini.
 */
export function GET() {
  return NextResponse.json(
    {
      ...geminiStatus(),
      photoAnalysis: process.env.ALLOW_PHOTO_ANALYSIS === "true",
      realAccountAI: process.env.ALLOW_REAL_AI_PROCESSING === "true",
    },
    { headers },
  );
}

/** POST runs ONE minimal live request (explicit developer action, throttled). */
export async function POST(req: NextRequest) {
  try {
    z.object({ check: z.literal(true) }).parse(await guardedBody(req));
    const last = lastLiveCheckAt();
    if (last && Date.now() - last < CHECK_INTERVAL_MS)
      throw new AIError(
        "CHECK_THROTTLED",
        "A live check ran less than a minute ago. Please wait to protect the quota.",
        429,
      );
    markLiveCheck();
    let ok = false,
      model: string | null = null,
      error: { code: string; message: string } | null = null;
    try {
      const r = await generateJSON(
        z.object({ ok: z.boolean() }),
        'Reply with the JSON object {"ok": true}.',
        { ping: true },
        { maxOutputTokens: 200, timeoutMs: 20000, maxRequests: 2 },
      );
      ok = r.ok === true;
      model = r.providerModel ?? null;
    } catch (e) {
      error =
        e instanceof AIError
          ? { code: e.code, message: e.message }
          : { code: "UNEXPECTED", message: "The live check failed." };
    }
    return NextResponse.json(
      { ok, model, error, status: geminiStatus() },
      { headers },
    );
  } catch (error) {
    return apiError(error);
  }
}
