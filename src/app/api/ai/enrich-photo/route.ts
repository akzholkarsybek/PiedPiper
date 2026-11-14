import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import {
  PHOTO_INSTRUCTION,
  rawPhotoSchema,
  verifyPhotoLabels,
} from "@/lib/enrichment";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ~2 MB per image after base64; at most three images per request. */
const MAX_IMAGE_CHARS = 2_800_000;
const bodySchema = z.object({
  photos: z
    .array(
      z.object({
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z
          .string()
          .min(100)
          .max(MAX_IMAGE_CHARS)
          .regex(/^[A-Za-z0-9+/]+=*$/),
      }),
    )
    .min(1)
    .max(3),
  existing: z.object({ interests: z.array(z.string().max(40)).max(12) }),
  ownPhotosConfirmed: z.literal(true),
  adultConfirmed: z.literal(true),
  processingConsent: z.literal(true),
  mode: z.enum(["demo", "real"]),
});

/**
 * Suggests ordinary activities/objects visible in a person's OWN photos, as
 * pending questions only. Off unless the server operator enables it
 * (ALLOW_PHOTO_ANALYSIS=true) with a provider configuration suitable for
 * personal images; free-tier keys should leave it off. Images are processed in
 * memory for this request only: never stored, logged, or shared.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.ALLOW_PHOTO_ANALYSIS !== "true")
      throw new AIError(
        "PHOTO_ANALYSIS_DISABLED",
        "Photo analysis is turned off on this server, because the free-tier Gemini configuration isn't suitable for personal photos. Your photos stayed on your device.",
        403,
      );
    const body = bodySchema.parse(await guardedBody(req, 9_000_000));
    if (body.mode === "real" && process.env.ALLOW_REAL_AI_PROCESSING !== "true")
      throw new AIError(
        "REAL_AI_DISABLED",
        "AI photo suggestions for real accounts are not enabled.",
        403,
      );
    const raw = await generateJSON(
      rawPhotoSchema,
      PHOTO_INSTRUCTION,
      { photoCount: body.photos.length },
      {
        maxOutputTokens: 600,
        timeoutMs: 30000,
        temperature: 0.2,
        maxRequests: 2,
        media: body.photos,
      },
    );
    const suggestions = verifyPhotoLabels(
      raw,
      body.photos.length,
      body.existing,
    );
    return NextResponse.json(
      {
        suggestions,
        dropped: raw.items.length - suggestions.length,
        providerNotice: raw.providerNotice ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
