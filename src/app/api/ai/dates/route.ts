import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { profileSchema } from "@/lib/profile";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import { computeOverlap, planningSchema } from "@/lib/planning";
import { intersection } from "@/lib/matching";
import {
  buildDateContext,
  DATE_INSTRUCTION,
  finalizeIdeas,
  rawIdeasSchema,
  rawVenueExplanationsSchema,
  VENUE_EXPLAIN_INSTRUCTION,
  verifyIdeas,
  verifyVenueExplanations,
} from "@/lib/dates";
import {
  defaultFilters,
  DISCOVERY_HORIZON_DAYS,
  prefersKind,
  recommendDates,
  venueName,
} from "@/lib/date-discovery";
import { activityLabels } from "@/lib/activities";
import { curatedProvider, discoverVenues } from "@/lib/places/provider";
import { cityIds } from "@/lib/places/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const common = {
  a: profileSchema,
  b: profileSchema,
  planning: z.object({
    a: planningSchema.nullable(),
    b: planningSchema.nullable(),
  }),
  /** Guest demo: the client asserts a mutual connection; real accounts would verify it in the database. */
  mutualConfirmed: z.literal(true),
  processingConsent: z.literal(true),
};
const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("ideas").default("ideas"), ...common }),
  z.object({
    mode: z.literal("venues"),
    ...common,
    city: z.enum(cityIds),
    ids: z.array(z.string().max(80)).min(1).max(3),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const raw = (await guardedBody(req)) as Record<string, unknown>;
    const body = bodySchema.parse({ mode: "ideas", ...raw });
    if (!body.a.fictional || !body.b.fictional)
      throw new AIError(
        "INVALID_CONTEXT",
        "First-date suggestions in this demo are limited to fictional profiles.",
        400,
      );
    if (body.mode === "venues") return await explainVenues(body);
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
    const ideasRaw = await generateJSON(
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
    const verified = verifyIdeas(ideasRaw, context);
    const ideas = finalizeIdeas(verified, context);
    const dropped = ideasRaw.suggestions.length - verified.length;
    return NextResponse.json(
      {
        ideas,
        source: "gemini",
        notice:
          [
            dropped > 0
              ? `${dropped} AI suggestion${dropped === 1 ? " was" : "s were"} removed because it was not grounded in your shared facts or named unverified venue details.`
              : "",
            ideasRaw.providerNotice ?? "",
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

/**
 * One Gemini call explains up to three recommendations. The items are
 * recomputed here from the verified dataset, so the model only ever sees
 * verified place/event fields plus approved shared facts.
 */
async function explainVenues(
  body: Extract<z.infer<typeof bodySchema>, { mode: "venues" }>,
) {
  const now = new Date();
  const overlap = computeOverlap(
    body.planning.a?.availability,
    body.planning.b?.availability,
    { from: now, days: DISCOVERY_HORIZON_DAYS },
  );
  const { places, events } = await discoverVenues(body.city, [curatedProvider]);
  const shared = intersection(body.a.interests, body.b.interests);
  const prefs = {
    a: body.planning.a?.datePreferences.activityTypes ?? [],
    b: body.planning.b?.datePreferences.activityTypes ?? [],
  };
  const result = recommendDates({
    mutual: true,
    names: { a: body.a.name, b: body.b.name },
    sharedInterests: shared,
    activityPrefs: prefs,
    overlap,
    now,
    places,
    events,
    filters: defaultFilters(body.city),
    limit: 3,
  });
  if (result.status !== "ok")
    throw new AIError("NOT_MATCHED", "Not matched.", 400);
  const all = [...result.recommendations, ...result.alternatives];
  const chosen = body.ids
    .map((id) => all.find((r) => r.venue.id === id))
    .filter((r): r is (typeof all)[number] => !!r);
  if (!chosen.length)
    throw new AIError(
      "NO_ITEMS",
      "These recommendations are no longer available. Refresh the list.",
      400,
    );
  const facts = [
    ...shared.map((i) => ({ id: `shared.interest.${i}`, value: i })),
    ...(["a", "b"] as const).flatMap((side) =>
      [...new Set(chosen.map((r) => r.venue.kind))]
        .filter((k) => prefersKind(prefs[side], k))
        .map((k) => ({
          id: `${side}.kind.${k}`,
          value: `${side === "a" ? body.a.name : body.b.name} enjoys ${activityLabels[k].toLowerCase()}`,
        })),
    ),
  ];
  const items = chosen.map((r) => ({
    id: r.venue.id,
    name: venueName(r.venue),
    venue: r.venue.type === "event" ? r.venue.venue : null,
    kind: activityLabels[r.venue.kind],
    category: r.venue.category,
    setting: r.venue.setting,
    tags: r.venue.tags,
  }));
  const raw = await generateJSON(
    rawVenueExplanationsSchema,
    VENUE_EXPLAIN_INSTRUCTION,
    { names: { a: body.a.name, b: body.b.name }, facts, items },
    {
      maxOutputTokens: 900,
      timeoutMs: 25000,
      temperature: 0.5,
      maxRequests: 3,
    },
  );
  const verified = verifyVenueExplanations(
    raw,
    items,
    new Set(facts.map((f) => f.id)),
  );
  return NextResponse.json(
    {
      explanations: Object.fromEntries(verified),
      rejected: raw.explanations.length - verified.size,
      providerNotice: raw.providerNotice ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
