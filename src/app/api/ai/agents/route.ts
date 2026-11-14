import { NextRequest } from "next/server";
import { z } from "zod";
import { profileSchema } from "@/lib/profile";
import { eligibility } from "@/lib/matching";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import {
  AgentError,
  DEFAULT_DEADLINE_MS,
  geminiBrain,
  runInvestigation,
  type AgentEvent,
} from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  a: profileSchema,
  b: profileSchema,
  handled: z.record(z.string().max(220), z.enum(["declined", "shared"])),
  /** The guest explicitly agreed to send fictional profile data to Gemini. */
  processingConsent: z.literal(true),
});

/**
 * Streams a bounded, two-agent Gemini investigation as NDJSON events.
 * Guest demo only: both profiles must be approved fictional adults.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await guardedBody(req));
    if (!body.a.fictional || !body.b.fictional)
      throw new AIError(
        "INVALID_CONTEXT",
        "AI matchmaker conversations are limited to fictional demo profiles.",
        400,
      );
    if (!eligibility(body.a, body.b).eligible)
      throw new AIError(
        "INELIGIBLE",
        "Matchmakers only investigate introductions that meet both people's requirements.",
        400,
      );
  } catch (error) {
    return apiError(error);
  }
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          abort.abort();
        }
      };
      try {
        await runInvestigation({
          a: body.a,
          b: body.b,
          handled: body.handled,
          brain: geminiBrain(generateJSON),
          onEvent: send,
          deadlineMs: DEFAULT_DEADLINE_MS,
          signal: abort.signal,
        });
      } catch (error) {
        send({
          type: "error",
          code: error instanceof AgentError ? error.code : "UNEXPECTED",
          message:
            error instanceof AgentError
              ? error.message
              : "The matchmakers could not start. The predefined demonstration is available.",
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
