"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarHeart,
  Check,
  CircleDashed,
  Heart,
  LoaderCircle,
  MessagesSquare,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell, NoProfile } from "./app-shell";
import { Portrait } from "./portrait";
import { PiperMark } from "./brand";
import { Button } from "./ui/button";
import { InvestigationModal } from "./discover";
import {
  AIModeBadge,
  invalidateGeminiStatus,
  liveUnavailable,
  useGeminiStatus,
} from "./ai-status";
import { dispatchDemo, matched, useDemo } from "@/lib/demo-store";
import { eligibility, recommend } from "@/lib/matching";
import { attributeLabel, dimensionLabels, type Profile } from "@/lib/profile";
import {
  agentEventSchema,
  buildApprovedContext,
  deterministicSummary,
  investigationBasis,
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  other,
  runInvestigation,
  scriptedBrain,
  type AgentBrain,
  type AgentEvent,
  type AgentSession,
  type AgentSummary,
  type AgentTurn,
  type ApprovedFact,
  type Topic,
} from "@/lib/agents";

type Live = {
  source: "gemini" | "scripted";
  status: "running" | "done" | "error";
  topics: Topic[];
  turns: AgentTurn[];
  summary: AgentSummary | null;
  facts: ApprovedFact[];
  error: string;
  notice: string;
  /** Fingerprint of the approved facts this run used. */
  basis: string;
};
const portraitFor = (p: Profile) =>
  p.id === "guest" ? p.name.toLocaleLowerCase() || "guest" : p.id;

export function AgentConversations({ initialId }: { initialId?: string }) {
  const state = useDemo(),
    [selected, setSelected] = useState(initialId ?? "");
  if (!state.profile?.approved)
    return (
      <AppShell>
        <NoProfile />
      </AppShell>
    );
  const profile = state.profile;
  const ranked = recommend(profile, state.candidates, state.weights).filter(
    (r) => state.decisions[r.profile.id] !== "pass",
  );
  const listed = [
    ...ranked.slice(0, 6).map((r) => r.profile),
    ...state.candidates.filter(
      (c) =>
        state.agentSessions[c.id] &&
        !ranked.slice(0, 6).some((r) => r.profile.id === c.id) &&
        !profile.blockedIds.includes(c.id),
    ),
  ];
  const peer =
    listed.find((p) => p.id === selected) ??
    state.candidates.find(
      (c) => c.id === selected && !profile.blockedIds.includes(c.id),
    ) ??
    listed[0];
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TWO MATCHMAKERS. ONE GOOD QUESTION.</span>
          <h1>
            Let our AIs <em>talk.</em>
          </h1>
          <p>
            Your matchmaker and theirs compare approved facts, so you start with
            what matters.
          </p>
        </div>
        <span className="badge sage">
          <ShieldCheck size={13} />
          FICTIONAL PROFILES ONLY
        </span>
      </div>
      {!peer ? (
        <div className="empty-state">
          <MessagesSquare size={34} />
          <h2>No introductions to investigate yet.</h2>
          <p>
            Matchmakers only talk about people who meet both sides’
            requirements. Check your introductions or preferences.
          </p>
          <Button asChild>
            <Link href="/discover">
              See your introductions <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="agents-layout">
          <aside className="agent-list" aria-label="Introductions">
            <h2>Introductions</h2>
            {listed.map((p) => {
              const s = state.agentSessions[p.id];
              return (
                <button
                  key={p.id}
                  className={peer.id === p.id ? "active" : ""}
                  aria-current={peer.id === p.id}
                  onClick={() => setSelected(p.id)}
                >
                  <div className="avatar-portrait">
                    <Portrait id={p.id} />
                  </div>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {matched(state, p.id)
                        ? "Mutual connection"
                        : s?.summary
                          ? s.summary.verdict === "clarify-first"
                            ? "A question is open"
                            : "Common ground found"
                          : "Not investigated yet"}
                    </small>
                  </span>
                </button>
              );
            })}
          </aside>
          <AgentTheater
            key={peer.id}
            profile={profile}
            peer={peer}
            session={state.agentSessions[peer.id]}
            handled={state.questions}
            decision={state.decisions[peer.id]}
            isMatched={matched(state, peer.id)}
          />
        </div>
      )}
    </AppShell>
  );
}

function AgentTheater({
  profile,
  peer,
  session,
  handled,
  decision,
  isMatched,
}: {
  profile: Profile;
  peer: Profile;
  session?: AgentSession;
  handled: Record<string, string>;
  decision?: string;
  isMatched: boolean;
}) {
  const [live, setLive] = useState<Live | null>(null),
    [consent, setConsent] = useState(false),
    [asking, setAsking] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [actionError, setActionError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const status = useGeminiStatus();
  const eligible = eligibility(profile, peer).eligible;
  const recommendation = eligible ? recommend(profile, [peer])[0] : undefined;
  const view: Live | null =
    live ??
    (session
      ? {
          source: session.source,
          status: session.status === "failed" ? "error" : "done",
          topics: session.topics,
          turns: session.turns,
          summary: session.summary,
          facts: session.facts,
          error: "",
          notice: session.notice ?? "",
          basis: session.basis,
        }
      : null);
  const factMap = useMemo(
    () => new Map((view?.facts ?? []).map((f) => [f.id, f])),
    [view?.facts],
  );
  const stale =
    !!view &&
    view.status === "done" &&
    eligible &&
    view.basis !== investigationBasis(profile, peer);
  const running = view?.status === "running";
  const names = { a: profile.name, b: peer.name };

  function start(source: "gemini" | "scripted", reuse = true) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const facts = [
      ...buildApprovedContext(profile, "a").facts,
      ...buildApprovedContext(peer, "b").facts,
    ];
    setNotice("");
    setLive({
      source,
      status: "running",
      topics: [],
      turns: [],
      summary: null,
      facts,
      error: "",
      notice: "",
      basis: investigationBasis(profile, peer),
    });
    const collected: { topics: Topic[]; turns: AgentTurn[] } = {
      topics: [],
      turns: [],
    };
    let completed = false;
    const handle = (e: AgentEvent) => {
      if (ac.signal.aborted) return;
      if (e.type === "plan") {
        collected.topics = e.topics;
        setLive((l) => l && { ...l, topics: e.topics });
      } else if (e.type === "turn") {
        collected.turns.push(e.turn);
        setLive((l) => l && { ...l, turns: [...l.turns, e.turn] });
      } else if (e.type === "summary")
        setLive((l) => l && { ...l, summary: e.summary });
      else if (e.type === "error")
        setLive((l) => l && { ...l, error: e.message });
      else if (e.type === "complete") {
        completed = true;
        finish(e.session);
      }
    };
    const finish = (s: AgentSession) => {
      if (s.source === "gemini") invalidateGeminiStatus();
      if (s.status !== "failed")
        try {
          dispatchDemo({ type: "agent-session", id: peer.id, session: s });
        } catch (err) {
          setActionError(
            err instanceof Error ? err.message : "Could not save this result.",
          );
        }
      setLive(
        (l) =>
          l && {
            ...l,
            status: s.status === "failed" ? "error" : "done",
            summary: s.summary,
            topics: s.topics,
            turns: s.turns,
            facts: s.facts,
            error:
              s.status === "failed"
                ? s.notice || "The matchmakers could not talk right now."
                : "",
            notice: s.notice ?? "",
          },
      );
    };
    const fail = (message: string) => {
      if (ac.signal.aborted) return;
      if (collected.turns.length) {
        // The stream ended early: keep the verified turns and label the result.
        finish({
          id: `gemini-${peer.id}-${Date.now().toString(36)}`,
          peerId: peer.id,
          source: "gemini",
          status: "partial",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          agents: {
            a: { name: profile.name, profileId: profile.id },
            b: { name: peer.name, profileId: peer.id },
          },
          topics: collected.topics,
          turns: collected.turns,
          facts,
          summary: deterministicSummary(profile, peer, handled),
          modelCalls: 0,
          basis: investigationBasis(profile, peer),
          notice:
            `${message} The completed turns are shown, with a summary assembled without AI.`.slice(
              0,
              400,
            ),
        });
      } else setLive((l) => l && { ...l, status: "error", error: message });
    };
    if (source === "scripted") {
      const brain = scriptedBrain();
      const wait = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ac.signal.aborted ? 0 : ms));
      const paced: AgentBrain = {
        source: "scripted",
        ask: async (i, o) => (await wait(900), brain.ask(i, o)),
        answer: async (i, o) => (await wait(1100), brain.answer(i, o)),
      };
      runInvestigation({
        a: profile,
        b: peer,
        handled,
        brain: paced,
        onEvent: handle,
        signal: ac.signal,
      }).catch((e) =>
        fail(e instanceof Error ? e.message : "The demonstration failed."),
      );
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/ai/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            a: profile,
            b: peer,
            handled,
            processingConsent: true,
            reuse,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? "The matchmakers could not start a conversation.",
          );
        }
        const reader = res.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let i;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) continue;
            try {
              const parsed = agentEventSchema.safeParse(JSON.parse(line));
              if (parsed.success) handle(parsed.data);
            } catch {
              /* ignore a malformed line; the result stays partial */
            }
          }
        }
        if (!completed) fail("The connection to the matchmakers ended early.");
      } catch (e) {
        if (ac.signal.aborted) return;
        fail(
          e instanceof Error
            ? e.message
            : "The matchmakers could not start a conversation.",
        );
      }
    })();
  }

  const nextTurn = (() => {
    if (!view || !running) return null;
    const i = view.turns.length;
    if (!view.topics.length) return "Planning the most useful questions…";
    if (i >= view.topics.length * 2)
      return "Assembling the summary from verified facts (no extra AI call)…";
    const topic = view.topics[Math.floor(i / 2)];
    return i % 2 === 0
      ? `Piper for ${names[topic.asker]} is preparing a question about ${topic.label.toLowerCase()}…`
      : `Piper for ${names[other(topic.asker)]} is checking ${names[other(topic.asker)]}’s approved profile…`;
  })();

  return (
    <section
      className="agent-theater"
      aria-label={`Matchmakers for you and ${peer.name}`}
    >
      <header className="agent-duo">
        <AgentCard name={profile.name} portrait={portraitFor(profile)} you />
        <div className={`agent-link ${running ? "active" : ""}`}>
          <ArrowLeftRight size={18} />
          <span>
            {running
              ? "In conversation"
              : view
                ? `${view.turns.filter((t) => t.role === "answer").length} round${view.turns.filter((t) => t.role === "answer").length === 1 ? "" : "s"}`
                : `${DEFAULT_ROUNDS}–${MAX_ROUNDS} rounds`}
          </span>
        </div>
        <AgentCard name={peer.name} portrait={peer.id} />
      </header>
      {view && <Progress view={view} />}
      {!view && (
        <div className="agent-intro">
          <PiperMark />
          <h2>
            Shall our matchmakers <em>compare notes?</em>
          </h2>
          <ul>
            <li>
              <Check size={14} /> Each matchmaker only sees its own person’s
              approved profile. Preferences, dealbreakers and interviews stay
              private.
            </li>
            <li>
              <Check size={14} /> {DEFAULT_ROUNDS} question-and-answer rounds, a{" "}
              {MAX_ROUNDS === 3 ? "third" : "further"} only for an important
              open question. No scores, no predictions.
            </li>
            <li>
              <Check size={14} /> Every confirmed fact is checked against
              approved data. Unknowns stay unknown until someone chooses to
              share.
            </li>
          </ul>
          {!eligible && (
            <p className="error-text" role="alert">
              This introduction no longer meets both people’s requirements, so
              the matchmakers won’t investigate it.
            </p>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Send these fictional profiles’ approved facts to Gemini for this
            conversation.
          </label>
          <div className="ai-mode-row">
            <AIModeBadge mode="live" status={status} />
          </div>
          {liveUnavailable(status) && (
            <p className="muted" role="status">
              Live AI can’t run right now, so nothing will be sent to Gemini.
              The scripted demonstration shows the same flow, clearly labeled.
            </p>
          )}
          <div className="inline-actions">
            <Button
              disabled={!consent || !eligible || liveUnavailable(status)}
              onClick={() => start("gemini")}
            >
              <Sparkles size={16} /> Let our AIs talk
            </Button>
            <Button
              variant="outline"
              disabled={!eligible}
              onClick={() => start("scripted")}
            >
              Play the scripted demonstration
            </Button>
          </div>
          <small>
            The scripted demonstration uses templates, never calls AI, and is
            labeled as scripted throughout.
          </small>
        </div>
      )}
      {view && (
        <>
          <div className={`source-banner ${view.source}`}>
            {view.source === "gemini" ? (
              <>
                <Sparkles size={14} />
                LIVE GEMINI CONVERSATION · two separate agent contexts · facts
                verified before display
              </>
            ) : (
              <>
                <PiperMark />
                PREDEFINED DEMONSTRATION · SCRIPTED · NOT AI-GENERATED
              </>
            )}
          </div>
          <div className="agent-transcript" aria-live="polite">
            <AnimatePresence initial={false}>
              {view.turns.map((t) => (
                <TurnBubble
                  key={t.id}
                  turn={t}
                  names={names}
                  topic={view.topics.find((x) => x.id === t.topicId)}
                  factMap={factMap}
                  source={view.source}
                />
              ))}
            </AnimatePresence>
            {nextTurn && (
              <div className="agent-typing" role="status">
                <LoaderCircle className="spin" size={15} /> {nextTurn}
              </div>
            )}
          </div>
          {view.error && (
            <div className="notice error-notice" role="alert">
              <div>
                <strong>The matchmakers couldn’t finish.</strong>
                <p>{view.error}</p>
                <div className="inline-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => start("scripted")}
                  >
                    Play the scripted demonstration instead
                  </Button>
                  {consent && !liveUnavailable(status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => start("gemini")}
                    >
                      Retry Gemini
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          {!view.error && view.notice && !running && (
            <div className="provider-notice agent-notice" role="status">
              {view.notice}
            </div>
          )}
        </>
      )}
      {view?.summary && !running && (
        <SummaryPanel
          summary={view.summary}
          factMap={factMap}
          names={names}
          peer={peer}
          profile={profile}
          handled={handled}
          isMatched={isMatched}
          canAsk={!!recommendation}
          onAsk={setAsking}
        />
      )}
      {stale && (
        <div className="notice sage-notice stale-notice">
          <RefreshCw size={17} />
          <p>
            Something changed since this conversation, such as an answer shared
            with consent. The introduction below is already recalculated; run
            the matchmakers again to investigate with the updated facts.
          </p>
        </div>
      )}
      {notice && (
        <div role="status" className="notice success-notice dismiss-notice">
          <p>{notice}</p>
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="error-text">
          {actionError}
        </p>
      )}
      {view && !running && (
        <div className="agent-rerun">
          <span>Run it again</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!eligible}
            onClick={() => start("scripted")}
          >
            Scripted demonstration
          </Button>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Send approved fictional facts to Gemini
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!consent || !eligible || liveUnavailable(status)}
            onClick={() => start("gemini", false)}
          >
            <Sparkles size={14} /> Live with Gemini
          </Button>
        </div>
      )}
      {view?.summary && !running && (
        <NextSteps
          peer={peer}
          recommendation={recommendation}
          eligible={eligible}
          decision={decision}
          isMatched={isMatched}
          onError={setActionError}
        />
      )}
      {asking && recommendation && (
        <InvestigationModal
          recommendation={recommendation}
          viewer={profile}
          handled={handled}
          initialKey={asking}
          onClose={() => setAsking(null)}
          onResult={(message) => {
            setAsking(null);
            setNotice(message);
          }}
        />
      )}
    </section>
  );
}

function AgentCard({
  name,
  portrait,
  you = false,
}: {
  name: string;
  portrait: string;
  you?: boolean;
}) {
  return (
    <div className={`agent-card ${you ? "side-a" : "side-b"}`}>
      <div className="agent-avatar">
        <Portrait id={portrait} />
        <span className="agent-chip">
          <PiperMark />
        </span>
      </div>
      <div>
        <strong>Piper for {name}</strong>
        <small>
          {you ? "Your matchmaker" : `${name}’s matchmaker`} · fictional
        </small>
      </div>
    </div>
  );
}

function Progress({ view }: { view: Live }) {
  const answered = view.turns.filter((t) => t.role === "answer").length;
  const steps = [
    {
      label: "Plan",
      done: view.topics.length > 0 || view.status !== "running",
    },
    ...Array.from({ length: Math.max(view.topics.length, 1) }, (_, i) => ({
      label: view.topics[i]?.label ?? `Round ${i + 1}`,
      done: answered > i,
    })),
    { label: "Summary", done: !!view.summary && view.status !== "running" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="agent-progress" aria-label="Investigation progress">
      {steps.map((s, i) => (
        <li
          key={`${s.label}-${i}`}
          className={
            s.done
              ? "done"
              : i === current && view.status === "running"
                ? "current"
                : ""
          }
        >
          <span>{s.done ? <Check size={11} /> : i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function EvidenceChips({
  ids,
  factMap,
  names,
}: {
  ids: string[];
  factMap: Map<string, ApprovedFact>;
  names: { a: string; b: string };
}) {
  if (!ids.length) return null;
  return (
    <ul className="evidence-chips" aria-label="Approved facts cited">
      {ids.map((id) => {
        const f = factMap.get(id);
        if (!f) return null;
        const value =
          f.value.length > 48 ? `${f.value.slice(0, 46)}…` : f.value;
        return (
          <li key={id} title={`${names[f.side]} · ${f.label}: ${f.value}`}>
            <BadgeCheck size={11} />
            <span>{names[f.side]}</span>{" "}
            {f.label === "Interest" || f.label === "Value"
              ? value
              : `${f.label}: ${value}`}
          </li>
        );
      })}
    </ul>
  );
}

function TurnBubble({
  turn,
  names,
  topic,
  factMap,
  source,
}: {
  turn: AgentTurn;
  names: { a: string; b: string };
  topic?: Topic;
  factMap: Map<string, ApprovedFact>;
  source: "gemini" | "scripted";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`agent-turn side-${turn.side} ${turn.role}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="agent-turn-meta">
        PIPER FOR {names[turn.side].toUpperCase()} ·{" "}
        {turn.role === "question" ? "ASKS" : "ANSWERS"} · ROUND {turn.round}
        {topic ? ` · ${topic.label.toUpperCase()}` : ""}
        <em>
          {source === "scripted"
            ? "SCRIPTED"
            : turn.answeredBy === "rule"
              ? "RULE · NO AI CALL"
              : "GEMINI"}
        </em>
      </span>
      <p>{turn.text}</p>
      {turn.role === "answer" && (
        <span className={`turn-status ${turn.status}`}>
          {turn.status === "confirmed" ? (
            <>
              <BadgeCheck size={12} /> Confirmed from approved profile
            </>
          ) : (
            <>
              <CircleDashed size={12} /> Unknown · not shared yet
            </>
          )}
        </span>
      )}
      <EvidenceChips ids={turn.evidence} factMap={factMap} names={names} />
      {turn.answeredBy === "rule" && source === "gemini" && (
        <small className="grounding-note">
          <ShieldCheck size={12} /> Nothing approved answers this, so it was
          answered by rule without asking the AI to guess.
        </small>
      )}
      {turn.grounding === "corrected" && (
        <small className="grounding-note">
          <ShieldCheck size={12} /> The AI draft couldn’t be fully verified, so
          this answer was rewritten from approved facts only.
        </small>
      )}
    </motion.div>
  );
}

function SummaryPanel({
  summary,
  factMap,
  names,
  peer,
  profile,
  handled,
  isMatched,
  canAsk,
  onAsk,
}: {
  summary: AgentSummary;
  factMap: Map<string, ApprovedFact>;
  names: { a: string; b: string };
  peer: Profile;
  profile: Profile;
  handled: Record<string, string>;
  isMatched: boolean;
  canAsk: boolean;
  onAsk: (key: string) => void;
}) {
  return (
    <div className="agent-summary">
      <div className={`verdict ${summary.verdict}`}>
        <span className="eyebrow">
          {summary.source === "gemini"
            ? "GEMINI SUMMARY · EVERY ITEM CITES VERIFIED FACTS"
            : "SUMMARY ASSEMBLED FROM VERIFIED FACTS · NO AI CALL"}
        </span>
        <h3>
          {summary.verdict === "clarify-first"
            ? "One important question first."
            : "Worth an introduction."}
        </h3>
        <p>{summary.explanation.text}</p>
        <small>
          This is an explanation, not a prediction. Hard requirements are
          checked by the matching engine, never by AI.
        </small>
      </div>
      {!!summary.sharedActivities?.length && (
        <div className="shared-activities">
          <h4>
            <CalendarHeart size={15} /> Things you could enjoy together
          </h4>
          <ul>
            {summary.sharedActivities.map((s) => (
              <li key={s.category}>
                <span>{s.label}</span>
                <EvidenceChips
                  ids={s.evidence.slice(0, 4)}
                  factMap={factMap}
                  names={names}
                />
                {isMatched ? (
                  <Link
                    className="text-link"
                    href={`/connections?with=${peer.id}&kind=${s.category}#discover`}
                  >
                    See real options in Astana <ArrowUpRight size={12} />
                  </Link>
                ) : (
                  <small>
                    Real places and events unlock after you both say yes.
                  </small>
                )}
              </li>
            ))}
          </ul>
          <small>
            Activity types from confirmed shared interests only. Real places and
            events are suggested from verified listings after you both say yes —
            the matchmakers never invent venues.
          </small>
        </div>
      )}
      <div className="summary-columns">
        <div className="summary-col confirmed">
          <h4>
            <Check size={15} /> Confirmed common ground
          </h4>
          {summary.commonGround.length ? (
            <ul>
              {summary.commonGround.map((c) => (
                <li key={c.text}>
                  {c.text}
                  <EvidenceChips
                    ids={c.evidence.slice(0, 4)}
                    factMap={factMap}
                    names={names}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>No confirmed common ground yet.</p>
          )}
        </div>
        <div className="summary-col differences">
          <h4>
            <Scale size={15} /> Possible differences
          </h4>
          {summary.possibleDifferences.length ? (
            <ul>
              {summary.possibleDifferences.map((c) => (
                <li key={c.text}>
                  {c.text}
                  <EvidenceChips
                    ids={c.evidence.slice(0, 4)}
                    factMap={factMap}
                    names={names}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>No stated differences in the approved facts.</p>
          )}
        </div>
        <div className="summary-col unknowns">
          <h4>
            <CircleDashed size={15} /> Still unknown
          </h4>
          {summary.unknowns.length ? (
            <ul>
              {summary.unknowns.map((u) => {
                const status = handled[u.key];
                const subject = u.subjectSide === "a" ? profile : peer;
                return (
                  <li key={u.key}>
                    {u.hard && (
                      <span className="hard-tag">Firm requirement</span>
                    )}
                    {status === "shared" ? (
                      <span className="resolved">
                        <BadgeCheck size={13} /> Resolved with consent:{" "}
                        {subject.name} shared “
                        {attributeLabel(
                          u.dimension,
                          subject.attributes[u.dimension],
                        )}
                        ”.
                      </span>
                    ) : status === "declined" ? (
                      <span>
                        {subject.name} chose not to share{" "}
                        {dimensionLabels[u.dimension].toLowerCase()}. It won’t
                        be asked again.
                      </span>
                    ) : (
                      <>
                        {u.text}
                        {canAsk && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAsk(u.key)}
                          >
                            {u.subjectSide === "b"
                              ? `Ask ${peer.name} with consent`
                              : "Answer for yourself"}
                            <ArrowUpRight size={14} />
                          </Button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Nothing important is unknown for either person’s preferences.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NextSteps({
  peer,
  recommendation,
  eligible,
  decision,
  isMatched,
  onError,
}: {
  peer: Profile;
  recommendation?: ReturnType<typeof recommend>[number];
  eligible: boolean;
  decision?: string;
  isMatched: boolean;
  onError: (message: string) => void;
}) {
  const act = (fn: () => void) => {
    try {
      fn();
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Please try again.");
    }
  };
  return (
    <div className="agent-next">
      <div className="agent-next-rec">
        <span className="eyebrow">
          <RefreshCw size={12} /> THE INTRODUCTION, RECALCULATED FROM APPROVED
          INFORMATION
        </span>
        {eligible && recommendation ? (
          <>
            <strong>{recommendation.label}</strong>
            <ul>
              {recommendation.evidence.slice(0, 3).map((e) => (
                <li key={e}>
                  <Check size={13} /> {e}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            A confirmed requirement no longer matches, so this introduction has
            been removed. The matchmakers cannot override a dealbreaker.
          </p>
        )}
      </div>
      {isMatched ? (
        <div className="agent-next-action">
          <Heart size={20} />
          <strong>You’re connected.</strong>
          <p>
            Compare general availability and discover real places and events for
            a first date.
          </p>
          <Button asChild>
            <Link href={`/connections?with=${peer.id}#discover`}>
              <CalendarHeart size={16} /> Plan your first date
            </Link>
          </Button>
        </div>
      ) : decision === "interested" ? (
        <div className="synthetic-choice agent-next-action">
          <p>
            <Check size={14} /> Your interest is saved.
          </p>
          <span>
            SIMULATE {peer.name.toUpperCase()}’S DECISION · FICTIONAL DEMO
          </span>
          <div>
            <Button
              size="sm"
              onClick={() =>
                act(() =>
                  dispatchDemo({
                    type: "counterpart",
                    id: peer.id,
                    decision: "interested",
                  }),
                )
              }
            >
              {peer.name} is also interested <Heart size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                act(() =>
                  dispatchDemo({
                    type: "counterpart",
                    id: peer.id,
                    decision: "pass",
                  }),
                )
              }
            >
              {peer.name} passes
            </Button>
          </div>
        </div>
      ) : eligible ? (
        <div className="agent-next-action">
          <strong>Your decision, always.</strong>
          <p>
            The matchmakers suggest; only people decide. {peer.name} will only
            see your interest if it’s mutual.
          </p>
          <Button
            onClick={() =>
              act(() =>
                dispatchDemo({
                  type: "decision",
                  id: peer.id,
                  decision: "interested",
                }),
              )
            }
          >
            <Heart size={16} /> I’m interested in {peer.name}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
