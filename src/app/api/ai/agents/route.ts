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
  investigationBasis,
  runInvestigation,
  type AgentEvent,
  type AgentSession,
} from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  a: profileSchema,
  b: profileSchema,
  handled: z.record(z.string().max(220), z.enum(["declined", "shared"])),
  /** The guest explicitly agreed to send fictional profile data to Gemini. */
  processingConsent: z.literal(true),
  /** Reuse a recent identical, completed conversation instead of new calls. */
  reuse: z.boolean().default(true),
});

/**
 * Completed live conversations for identical approved inputs are reused for a
 * short time, so page refreshes and repeated clicks never spend quota. Only
 * fictional demo data is cached, in this server process, for 30 minutes.
 */
const REUSE_MS = 30 * 60 * 1000;
const recent = new Map<string, { at: number; session: AgentSession }>();
function reuseKey(body: z.infer<typeof bodySchema>) {
  const handled = Object.entries(body.handled).sort(([x], [y]) =>
    x.localeCompare(y),
  );
  return JSON.stringify([
    body.a.id,
    body.b.id,
    investigationBasis(body.a, body.b),
    handled,
  ]);
}

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
        const key = reuseKey(body);
        const now = Date.now();
        for (const [k, v] of recent)
          if (now - v.at > REUSE_MS) recent.delete(k);
        const hit = body.reuse ? recent.get(key) : undefined;
        if (hit) {
          const s = hit.session;
          const minutes = Math.max(1, Math.round((now - hit.at) / 60000));
          const session: AgentSession = {
            ...s,
            notice:
              `Reused the verified conversation from ${minutes} min ago for the same approved facts — no new Gemini requests. ${s.notice ?? ""}`
                .trim()
                .slice(0, 400),
          };
          send({
            type: "plan",
            topics: s.topics,
            agents: s.agents,
            source: s.source,
          });
          for (const turn of s.turns) send({ type: "turn", turn });
          if (s.summary) send({ type: "summary", summary: s.summary });
          send({ type: "complete", session });
          return;
        }
        const session = await runInvestigation({
          a: body.a,
          b: body.b,
          handled: body.handled,
          brain: geminiBrain(generateJSON),
          onEvent: send,
          deadlineMs: DEFAULT_DEADLINE_MS,
          signal: abort.signal,
        });
        if (session.status === "complete") {
          if (recent.size > 200) recent.clear();
          recent.set(key, { at: Date.now(), session });
        }
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
