import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import { dateCategories } from "@/lib/planning";
import {
  enrichmentInputSchema,
  ENRICH_INSTRUCTION,
  rawEnrichmentSchema,
  verifyEnrichment,
} from "@/lib/enrichment";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  input: enrichmentInputSchema,
  existing: z.object({
    interests: z.array(z.string().max(40)).max(12),
    activityTypes: z.array(z.enum(dateCategories)).max(dateCategories.length),
  }),
  adultConfirmed: z.literal(true),
  processingConsent: z.literal(true),
  mode: z.enum(["demo", "real"]),
});

/** Returns PENDING suggestions only. Nothing is applied to a profile here. */
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await guardedBody(req));
    if (body.mode === "real" && process.env.ALLOW_REAL_AI_PROCESSING !== "true")
      throw new AIError(
        "REAL_AI_DISABLED",
        "AI profile enrichment for real accounts is not enabled. You can edit your profile manually.",
        403,
      );
    const raw = await generateJSON(
      rawEnrichmentSchema,
      ENRICH_INSTRUCTION,
      { providedText: body.input },
      { maxOutputTokens: 3000, timeoutMs: 30000, temperature: 0.5 },
    );
    const suggestions = verifyEnrichment(raw, body.input, body.existing);
    return NextResponse.json(
      {
        suggestions,
        source: "gemini",
        providerNotice: raw.providerNotice,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
