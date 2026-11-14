import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/ai/onboard/route";
import { onboardingResponseSchema } from "../src/lib/ai-schema";
import { reviewableDraft, interviewMissing } from "../src/lib/onboarding";
import { sampleProfile } from "../src/lib/fixtures";
import { setGeminiClientFactory } from "../src/lib/gemini";
import { resetGeminiHealth } from "../src/lib/gemini-health";
import { speechError } from "../src/lib/speech";
const response = () => ({
  message:
    "What partner age range, locality and intention filter do you prefer?",
  draft: {
    ...sampleProfile(),
    preferences: {
      ...sampleProfile().preferences,
      minAge: null,
      maxAge: null,
      locationMode: null,
      strictIntent: null,
    },
  },
  readyForReview: true,
  proposedInterpretations: ["You may enjoy outdoor first dates."],
});
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
  vi.stubEnv("GEMINI_MODEL", "test-model");
  resetGeminiHealth();
});
afterEach(() => {
  setGeminiClientFactory(null);
  vi.unstubAllEnvs();
});
function req(body: unknown) {
  return new NextRequest("http://localhost/api/ai/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
describe("Reviewed voice transcript → structured Gemini onboarding", () => {
  it("allows a partial age preference outside the former default range", () => {
    const draft = onboardingResponseSchema.parse(response()).draft;
    draft.preferences.maxAge = 22;
    expect(reviewableDraft(draft).missingPreferences).toContain("minAge");
    expect(reviewableDraft(draft).profile.preferences.maxAge).toBe(22);
    draft.preferences.minAge = 70;
    draft.preferences.maxAge = null;
    expect(reviewableDraft(draft).profile.preferences.minAge).toBe(70);
  });
  it("keeps unprovided preferences missing and interpretations outside approved facts", () => {
    const result = onboardingResponseSchema.parse(response());
    const review = reviewableDraft(result.draft);
    expect(review.missingPreferences).toEqual([
      "minAge",
      "maxAge",
      "locationMode",
      "strictIntent",
    ]);
    expect(review.profile.approved).toBe(false);
    expect(interviewMissing(result.draft)).toContain("minAge");
    expect(review.profile.interests).not.toContain("outdoor first dates");
  });
  it("returns focused follow-up data and cannot mark an incomplete preference draft ready", async () => {
    let system = "";
    setGeminiClientFactory(
      () =>
        ({
          models: {
            generateContent: async (input: {
              config: { systemInstruction: string };
            }) => {
              system = input.config.systemInstruction;
              return { text: JSON.stringify(response()) };
            },
          },
        }) as never,
    );
    const res = await POST(
      req({
        messages: [
          {
            role: "user",
            content:
              "Corrected fictional transcript: Jamie, 32, a man in Astana.",
          },
        ],
        adultConfirmed: true,
        processingConsent: true,
        mode: "demo",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.readyForReview).toBe(false);
    expect(data.draft.preferences.minAge).toBeNull();
    expect(data.proposedInterpretations).toHaveLength(1);
    expect(system).toContain("NO assumed");
  });
  it("does not call Gemini without adult and processing consent", async () => {
    const generate = vi.fn();
    setGeminiClientFactory(
      () => ({ models: { generateContent: generate } }) as never,
    );
    const res = await POST(
      req({
        messages: [{ role: "user", content: "hello" }],
        adultConfirmed: true,
        processingConsent: false,
        mode: "demo",
      }),
    );
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("surfaces quota exhaustion explicitly", async () => {
    setGeminiClientFactory(
      () =>
        ({
          models: {
            generateContent: async () => {
              throw Object.assign(new Error("quota"), { status: 429 });
            },
          },
        }) as never,
    );
    const res = await POST(
      req({
        messages: [{ role: "user", content: "Fictional test" }],
        adultConfirmed: true,
        processingConsent: true,
        mode: "demo",
      }),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).source).toBeUndefined();
  });
  it("maps permission/network errors to honest text fallbacks", () => {
    expect(speechError("not-allowed")).toContain("denied");
    expect(speechError("network")).toContain("typing");
    expect(speechError("no-speech")).toContain("No speech");
  });
});
