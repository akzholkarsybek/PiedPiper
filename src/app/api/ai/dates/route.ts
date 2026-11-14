import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { profileSchema } from "@/lib/profile";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import { computeOverlap, planningSchema } from "@/lib/planning";
import {
  buildDateContext,
  DATE_INSTRUCTION,
  finalizeIdeas,
  rawIdeasSchema,
  verifyIdeas,
} from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  a: profileSchema,
  b: profileSchema,
  planning: z.object({
    a: planningSchema.nullable(),
    b: planningSchema.nullable(),
  }),
  /** Guest demo: the client asserts a mutual connection; real accounts would verify it in the database. */
  mutualConfirmed: z.literal(true),
  processingConsent: z.literal(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await guardedBody(req));
    if (!body.a.fictional || !body.b.fictional)
      throw new AIError(
        "INVALID_CONTEXT",
        "First-date suggestions in this demo are limited to fictional profiles.",
        400,
      );
    // Recompute overlap here: client-sent windows are never trusted, and the
    // consent check in computeOverlap applies on the server too.
    const overlap = computeOverlap(
      body.planning.a?.availability,
      body.planning.b?.availability,
      { from: new Date() },
    );
    const windows = overlap.status === "ok" ? overlap.windows : [];
    const timeZone = body.planning.a?.availability?.timeZone ?? "UTC";
    const context = buildDateContext(
      body.a,
      body.b,
      body.planning,
      windows,
      timeZone,
    );
    const raw = await generateJSON(
      rawIdeasSchema,
      DATE_INSTRUCTION,
      {
        names: context.names,
        generalCity: context.city ?? "different cities",
        facts: context.facts,
        windows: context.windows,
      },
      { maxOutputTokens: 2500, timeoutMs: 30000, temperature: 0.6 },
    );
    const verified = verifyIdeas(raw, context);
    const ideas = finalizeIdeas(verified, context);
    const dropped = raw.suggestions.length - verified.length;
    return NextResponse.json(
      {
        ideas,
        source: "gemini",
        notice:
          [
            dropped > 0
              ? `${dropped} AI suggestion${dropped === 1 ? " was" : "s were"} removed because it was not grounded in your shared facts or named unverified venue details.`
              : "",
            raw.providerNotice ?? "",
          ]
            .filter(Boolean)
            .join(" ") || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
