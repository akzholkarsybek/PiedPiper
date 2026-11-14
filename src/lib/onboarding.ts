import { z } from "zod";
import {
  blankProfile,
  profileSchema,
  attributesSchema,
  genders,
} from "./profile";

// Interview facts allow absent preferences. The approved matching schema remains
// strict; no numeric/city/intention defaults are approved behind the user's back.
export const interviewDraftSchema = profileSchema
  .omit({
    id: true,
    approved: true,
    fictional: true,
    blockedIds: true,
    readyToConnect: true,
  })
  .extend({
    preferences: z.object({
      minAge: z.number().int().min(18).max(100).nullable(),
      maxAge: z.number().int().min(18).max(100).nullable(),
      genders: z.array(z.enum(genders)).max(3),
      locationMode: z.enum(["local", "anywhere"]).nullable(),
      strictIntent: z.boolean().nullable(),
      desired: attributesSchema,
      hard: z.array(z.enum(["children", "smoking", "drinking", "pace"])).max(4),
    }),
  });
export type InterviewDraft = z.infer<typeof interviewDraftSchema>;
export const preferenceFields = [
  "minAge",
  "maxAge",
  "locationMode",
  "strictIntent",
] as const;
export type MissingPreference = (typeof preferenceFields)[number];
export const preferenceLabels: Record<MissingPreference, string> = {
  minAge: "minimum partner age",
  maxAge: "maximum partner age",
  locationMode: "location preference",
  strictIntent: "whether matching relationship intentions are required",
};
export function reviewableDraft(draft: InterviewDraft) {
  const missingPreferences = preferenceFields.filter(
    (key) => draft.preferences[key] === null,
  );
  const blank = blankProfile();
  return {
    profile: profileSchema.parse({
      ...blank,
      ...draft,
      preferences: {
        ...draft.preferences,
        // Internal bounds only: missing values render as REQUIRED blank inputs
        // in ProfileEditor. Broad placeholders avoid rejecting a valid partial
        // answer such as "partners no older than 22" before the follow-up.
        minAge: draft.preferences.minAge ?? 18,
        maxAge: draft.preferences.maxAge ?? 100,
        locationMode: draft.preferences.locationMode ?? "local",
        strictIntent: draft.preferences.strictIntent ?? true,
      },
    }),
    missingPreferences,
  };
}
export function interviewMissing(draft: InterviewDraft) {
  return [
    ...(!draft.name.trim() ? ["name"] : []),
    ...(!draft.age ? ["adult age"] : []),
    ...(!draft.gender ? ["gender"] : []),
    ...(!draft.city.trim() ? ["city"] : []),
    ...(!draft.intent ? ["relationship intention"] : []),
    ...(!draft.preferences.genders.length ? ["dating preferences"] : []),
    ...preferenceFields.filter((k) => draft.preferences[k] === null),
  ];
}
