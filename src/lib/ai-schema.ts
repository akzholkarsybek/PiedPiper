import { z } from "zod";
import { profileSchema } from "./profile";
export const transcriptSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2500),
    }),
  )
  .max(30);
export type InterviewMessage = z.infer<typeof transcriptSchema>[number];
export const draftSchema = profileSchema.omit({
  id: true,
  approved: true,
  fictional: true,
  blockedIds: true,
});
export const onboardingResponseSchema = z.object({
  message: z.string().min(1).max(1500),
  draft: draftSchema,
  readyForReview: z.boolean(),
});
