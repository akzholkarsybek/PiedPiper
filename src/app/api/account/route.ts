import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "@/lib/supabase/server";
import { apiError, guardedBody } from "@/lib/api-guard";
import { AIError } from "@/lib/gemini";
import {
  profileSchema,
  dimensionKeys,
  dimensionOptions,
  requiredMissing,
} from "@/lib/profile";
import { recommend, eligibility, missingInformation } from "@/lib/matching";
import {
  availabilitySchema,
  dateCategories,
  datePreferencesSchema,
  venueRefSchema,
} from "@/lib/planning";
import { instagramSchema } from "@/lib/social";

export const dynamic = "force-dynamic";
function check(error: unknown) {
  if (error)
    throw new AIError(
      "DATABASE_ERROR",
      "This action could not be completed. Check access, profile approval, and the database migration.",
      400,
    );
}
export async function GET() {
  try {
    const { db, user } = await authenticated();
    const [profiles, decisions, matches, messages, questions, blocks] =
      await Promise.all([
        db.from("profiles").select("id,data").limit(200),
        db.from("decisions").select("*"),
        db.from("matches").select("*"),
        db.from("messages").select("*").order("created_at").limit(500),
        db.from("compatibility_questions").select("*"),
        db.from("blocks").select("target_id"),
      ]);
    [profiles, decisions, matches, messages, questions, blocks].forEach((r) =>
      check(r.error),
    );
    // Phase 2 (requires 002_phase2.sql). RLS returns only your own planning row
    // plus rows that mutual, unblocked matches chose to share.
    const [planning, proposals, social] = await Promise.all([
      db.from("member_planning").select("*"),
      db.from("date_proposals").select("*").order("created_at").limit(200),
      // Phase 2.2 (003): your own row plus usernames others chose to show.
      db
        .from("member_social")
        .select("owner_id,instagram_handle,instagram_visible"),
    ]);
    const self = profiles.data?.find((p) => p.id === user.id);
    const profile = self
      ? profileSchema.parse({
          ...self.data,
          blockedIds: blocks.data?.map((b) => b.target_id) ?? [],
        })
      : null;
    const candidates =
      profiles.data
        ?.filter((p) => p.id !== user.id)
        .flatMap((p) => {
          const parsed = profileSchema.safeParse(p.data);
          return parsed.success ? [parsed.data] : [];
        }) ?? [];
    const rankings = profile ? recommend(profile, candidates) : [];
    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        profile,
        candidates: rankings,
        decisions: decisions.data,
        matches: matches.data,
        messages: messages.data,
        questions: questions.data,
        planning: planning.error ? [] : planning.data,
        proposals: proposals.error ? [] : proposals.data,
        social: social.error ? [] : social.data,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("profile"), profile: profileSchema }),
  z.object({
    type: z.literal("decision"),
    target: z.uuid(),
    decision: z.enum(["interested", "pass"]),
  }),
  z.object({
    type: z.literal("message"),
    matchId: z.uuid(),
    text: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal("block"),
    target: z.uuid(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal("question"),
    target: z.uuid(),
    dimension: z.enum(dimensionKeys),
  }),
  z.object({
    type: z.literal("answer"),
    questionId: z.uuid(),
    answer: z.string().max(20),
    consent: z.boolean(),
  }),
  z.object({
    type: z.literal("feedback"),
    target: z.uuid(),
    reason: z.string().min(1).max(500),
  }),
  z.object({ type: z.literal("delete") }),
  z.object({
    type: z.literal("planning"),
    availability: availabilitySchema.nullable(),
    datePreferences: datePreferencesSchema,
  }),
  z.object({
    type: z.literal("propose"),
    matchId: z.uuid(),
    category: z.enum(dateCategories),
    title: z.string().trim().min(1).max(100),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    /** Optional verified place/event reference (requires 003_phase2_2.sql). */
    venue: venueRefSchema.optional(),
  }),
  z.object({
    type: z.literal("social"),
    instagram: instagramSchema.nullable(),
  }),
  z.object({
    type: z.literal("proposal-response"),
    proposalId: z.uuid(),
    response: z.enum(["accepted", "declined", "withdrawn"]),
  }),
]);
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await authenticated(),
      action = actionSchema.parse(await guardedBody(req));
    if (action.type === "profile") {
      const profile = profileSchema.parse({
        ...action.profile,
        id: user.id,
        fictional: false,
        blockedIds: [],
      });
      if (requiredMissing(profile).length || !profile.approved)
        throw new AIError(
          "INVALID_PROFILE",
          "Complete the essentials and explicitly approve your profile.",
          400,
        );
      const { error } = await db
        .from("profiles")
        .upsert({ id: user.id, data: profile });
      check(error);
    } else if (action.type === "delete") {
      const { error } = await db.rpc("delete_my_data");
      check(error);
    } else if (action.type === "decision") {
      if (action.decision === "interested") {
        const { data, error } = await db
          .from("profiles")
          .select("id,data")
          .in("id", [user.id, action.target]);
        check(error);
        const a = data?.find((x) => x.id === user.id),
          b = data?.find((x) => x.id === action.target);
        if (
          !a ||
          !b ||
          !eligibility(profileSchema.parse(a.data), profileSchema.parse(b.data))
            .eligible
        )
          throw new AIError(
            "INELIGIBLE",
            "This person does not currently meet your mutual requirements.",
            400,
          );
      }
      const { error } = await db.rpc("record_decision", {
        target: action.target,
        choice: action.decision,
      });
      check(error);
    } else if (action.type === "message") {
      const { error } = await db.from("messages").insert({
        match_id: action.matchId,
        sender_id: user.id,
        body: action.text,
      });
      check(error);
    } else if (action.type === "block") {
      const { error } = await db.rpc("block_person", {
        target: action.target,
        reason: action.reason ?? null,
      });
      check(error);
    } else if (action.type === "question") {
      const { data, error } = await db
        .from("profiles")
        .select("id,data")
        .in("id", [user.id, action.target]);
      check(error);
      const a = data?.find((x) => x.id === user.id),
        b = data?.find((x) => x.id === action.target);
      if (!a || !b)
        throw new AIError("UNAVAILABLE", "This profile is unavailable.", 404);
      const self = profileSchema.parse(a.data),
        peer = profileSchema.parse(b.data);
      if (
        !eligibility(self, peer).eligible ||
        !missingInformation(self, peer).some(
          (q) => q.subjectId === peer.id && q.dimension === action.dimension,
        )
      )
        throw new AIError(
          "IRRELEVANT",
          "This question is not relevant or already answered.",
          400,
        );
      const { error: insertError } = await db
        .from("compatibility_questions")
        .insert({
          requester_id: user.id,
          subject_id: action.target,
          dimension: action.dimension,
        });
      check(insertError);
    } else if (action.type === "answer") {
      const { data, error } = await db
        .from("compatibility_questions")
        .select("dimension")
        .eq("id", action.questionId)
        .eq("subject_id", user.id)
        .single();
      check(error);
      if (
        action.consent &&
        !dimensionOptions[
          data!.dimension as keyof typeof dimensionOptions
        ].some((v) => v === action.answer)
      )
        throw new AIError(
          "INVALID_ANSWER",
          "Choose an allowed answer for this question.",
          400,
        );
      const { error: answerError } = await db.rpc("answer_question", {
        question_id: action.questionId,
        answer: action.answer,
        share: action.consent,
      });
      check(answerError);
    } else if (action.type === "planning") {
      const {
        timeZone,
        slots,
        openToMeetingSoon,
        preference,
        shareWithMatches,
      } = action.availability ?? {};
      const { error } = await db.from("member_planning").upsert({
        owner_id: user.id,
        availability: action.availability
          ? { timeZone, slots, openToMeetingSoon, preference }
          : null,
        date_preferences: action.datePreferences,
        share_availability: !!shareWithMatches,
        updated_at: new Date().toISOString(),
      });
      check(error);
    } else if (action.type === "propose") {
      // Membership, impersonation and status are enforced by RLS in 002_phase2.sql.
      const { error } = await db.from("date_proposals").insert({
        match_id: action.matchId,
        proposer_id: user.id,
        category: action.category,
        title: action.title,
        starts_at: action.start,
        ends_at: action.end,
        ...(action.venue ? { venue: action.venue } : {}),
      });
      check(error);
    } else if (action.type === "social") {
      // Stored outside profiles.data so a hidden username is never readable
      // by others (RLS in 003_phase2_2.sql). Removing deletes the row.
      const { error } = action.instagram
        ? await db.from("member_social").upsert({
            owner_id: user.id,
            instagram_handle: action.instagram.handle,
            instagram_visible: action.instagram.visibleToMatches,
            updated_at: new Date().toISOString(),
          })
        : await db.from("member_social").delete().eq("owner_id", user.id);
      check(error);
    } else if (action.type === "proposal-response") {
      const { error } = await db.rpc("respond_date_proposal", {
        proposal: action.proposalId,
        response: action.response,
      });
      check(error);
    } else if (action.type === "feedback") {
      const { error } = await db.from("feedback").insert({
        owner_id: user.id,
        target_id: action.target,
        reason: action.reason,
      });
      check(error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
