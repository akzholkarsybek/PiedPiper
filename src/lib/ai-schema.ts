import { z } from "zod";
import { interviewDraftSchema } from "./onboarding";
export const transcriptSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2500),
    }),
  )
  .max(30);
export type InterviewMessage = z.infer<typeof transcriptSchema>[number];
export const draftSchema = interviewDraftSchema;
export const onboardingResponseSchema = z.object({
  message: z.string().min(1).max(1500),
  draft: draftSchema,
  readyForReview: z.boolean(),
  proposedInterpretations: z.array(z.string().max(250)).max(5).default([]),
});
