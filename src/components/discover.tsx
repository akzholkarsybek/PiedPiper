"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
  Flag,
  SlidersHorizontal,
  LoaderCircle,
  MessagesSquare,
  CirclePause,
} from "lucide-react";
import { AppShell, NoProfile } from "./app-shell";
import { Portrait } from "./portrait";
import { PiperMark } from "./brand";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import { MotionCard } from "./motion-card";
import { dispatchDemo, matched, useDemo } from "@/lib/demo-store";
import {
  recommend,
  type Recommendation,
  type Investigation,
} from "@/lib/matching";
import {
  attributeLabel,
  dimensionLabels,
  dimensionOptions,
  title,
  type Profile,
} from "@/lib/profile";

export function Discover() {
  const state = useDemo(),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState<"all" | "questions" | "interested">("all");
  const [investigating, setInvestigating] = useState<string | null>(null),
    [passing, setPassing] = useState<string | null>(null),
    [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("Not the connection I’m looking for"),
    [prioritize, setPrioritize] = useState(false),
    [showAll, setShowAll] = useState(false);
  if (!state.profile?.approved)
    return (
      <AppShell>
        <NoProfile />
      </AppShell>
    );
  const profile = state.profile;
  const paused = profile.readyToConnect === false;
  const ranked = recommend(profile, state.candidates, state.weights),
    available = ranked.filter(
      (r) =>
        state.decisions[r.profile.id] !== "pass" &&
        state.counterparts[r.profile.id] !== "pass",
    );
  const filtered = available.filter((r) =>
    filter === "questions"
      ? r.missing.some((q) => !state.questions[q.key])
      : filter === "interested"
        ? state.decisions[r.profile.id] === "interested"
        : true,
  );
  const selected = ranked.find((r) => r.profile.id === investigating);
  function act(fn: () => void, message: string) {
    try {
      fn();
      setNotice(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    }
  }
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THOUGHTFULLY CHOSEN. NEVER ENDLESS.</span>
          <h1>
            A little more <em>possibility.</em>
          </h1>
          <p>
            {profile.name}, meet a few people who share what matters to you.
          </p>
        </div>
        <Link href="/profile" className="preference-link">
          <SlidersHorizontal size={17} />
          Your preferences
        </Link>
      </div>
      <div className="matchmaker-banner">
        <PiperMark />
        <div>
          <strong>
            Thoughtful introductions start with the right questions.
          </strong>
          <p>
            I’ve looked at both sides of every introduction. You’ll see the
            common ground, the differences, and what we haven’t learned yet.
          </p>
        </div>
        <span className="banner-flower">✳</span>
      </div>
      {paused && (
        <div className="notice paused-notice" role="status">
          <CirclePause size={19} />
          <p>
            <strong>Ready to Connect is paused.</strong> You won’t receive or
            appear in new introductions. Your connections and messages are
            unchanged.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              act(
                () => dispatchDemo({ type: "ready", ready: true }),
                "Welcome back. Ready to Connect is on and new introductions are open.",
              )
            }
          >
            Resume introductions
          </Button>
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
      <div className="discovery-toolbar">
        <div className="tabs" role="group" aria-label="Filter introductions">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => {
              setFilter("all");
              setShowAll(false);
            }}
          >
            For you <span>{available.length}</span>
          </button>
          <button
            className={filter === "questions" ? "active" : ""}
            onClick={() => setFilter("questions")}
          >
            A question to explore
          </button>
          <button
            className={filter === "interested" ? "active" : ""}
            onClick={() => setFilter("interested")}
          >
            Your interest
          </button>
        </div>
        <span className="curated-note">
          <Sparkles size={13} />A considered collection
        </span>
      </div>
      {!filtered.length ? (
        <div className="empty-state">
          <Heart size={32} />
          <h2>
            {paused
              ? "Taking a pause."
              : filter === "interested"
                ? "A connection starts with interest."
                : "Room for a different beginning."}
          </h2>
          <p>
            {filter === "interested"
              ? "When someone catches your curiosity, let them know."
              : filter === "questions"
                ? "No unanswered, relevant questions in this collection."
                : "No profiles currently meet both people’s requirements. You can adjust your preferences or revisit passed introductions."}
          </p>
          <div className="inline-actions">
            <Button variant="outline" onClick={() => setFilter("all")}>
              See all introductions
            </Button>
            <Button asChild>
              <Link href="/profile">Review preferences</Link>
            </Button>
            {filter === "all" && (
              <Button
                variant="ghost"
                onClick={() =>
                  act(
                    () => dispatchDemo({ type: "reset-decisions" }),
                    "Interest and pass decisions have been reset. Blocks are preserved.",
                  )
                }
              >
                Revisit passed introductions
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="recommendation-grid">
          {filtered.slice(0, showAll ? 6 : 3).map((r, i) => (
            <MatchCard
              key={r.profile.id + JSON.stringify(r.profile.attributes)}
              recommendation={r}
              viewer={profile}
              index={i}
              decision={state.decisions[r.profile.id]}
              isMatched={matched(state, r.profile.id)}
              hasAgentSession={!!state.agentSessions[r.profile.id]}
              pendingQuestions={r.missing.filter(
                (q) => !state.questions[q.key],
              )}
              declinedCount={
                r.missing.filter((q) => state.questions[q.key] === "declined")
                  .length
              }
              onInterest={() =>
                act(
                  () =>
                    dispatchDemo({
                      type: "decision",
                      id: r.profile.id,
                      decision: "interested",
                    }),
                  `Your interest in ${r.profile.name} is saved. A connection needs their interest too.`,
                )
              }
              onPass={() => {
                setPassing(r.profile.id);
                setPrioritize(false);
              }}
              onInvestigate={() => setInvestigating(r.profile.id)}
              onCounterpart={(decision) =>
                act(
                  () =>
                    dispatchDemo({
                      type: "counterpart",
                      id: r.profile.id,
                      decision,
                    }),
                  decision === "interested"
                    ? `Demo: ${r.profile.name} also expressed interest. Your messaging space is open.`
                    : `Demo: ${r.profile.name} passed. No connection was created.`,
                )
              }
              onReport={() => setReporting(r.profile.id)}
            />
          ))}
        </div>
      )}
      {!showAll && filtered.length > 3 && (
        <div className="load-more">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Meet a few more <ArrowRight size={16} />
          </Button>
          <p>Up to six thoughtful introductions. Then take a breath.</p>
        </div>
      )}
      <div className="discovery-footnote">
        <ShieldCheck size={18} />
        <p>
          These are introductions, not predictions. Our ranking uses shared
          facts and mutual preferences—never a probability of romance.{" "}
          {state.weights.interests === 30 &&
            "Your feedback gives shared interests extra weight."}
        </p>
        <Link href="/about-matching">
          How we choose <ArrowUpRight size={14} />
        </Link>
      </div>
      {selected && (
        <InvestigationModal
          recommendation={selected}
          viewer={profile}
          handled={state.questions}
          onClose={() => setInvestigating(null)}
          onResult={(message) => {
            setInvestigating(null);
            setNotice(message);
          }}
        />
      )}
      {passing && (
        <Modal
          title="A little feedback helps."
          onClose={() => setPassing(null)}
        >
          <p className="muted">
            Your feedback stays in this fictional demo. You decide whether it
            should change future introductions.
          </p>
          <label>
            What didn’t feel right?
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Not the connection I’m looking for</option>
              <option>I’d like more shared interests</option>
              <option>Our lifestyles feel different</option>
              <option>I’d rather not say</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={prioritize}
              onChange={(e) => setPrioritize(e.target.checked)}
            />
            Give shared interests more weight in future introductions
          </label>
          <Button
            onClick={() => {
              act(
                () =>
                  dispatchDemo({
                    type: "decision",
                    id: passing,
                    decision: "pass",
                    reason,
                    prioritizeInterests: prioritize,
                  }),
                prioritize
                  ? "Feedback saved. Shared interests now carry more weight, and your introductions have been reordered."
                  : "Feedback saved. This introduction has been passed.",
              );
              setPassing(null);
            }}
          >
            Save feedback & pass <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
      {reporting && (
        <SafetyModal
          name={state.candidates.find((c) => c.id === reporting)!.name}
          onClose={() => setReporting(null)}
          onSubmit={(report) => {
            act(
              () => dispatchDemo({ type: "block", id: reporting, report }),
              report
                ? "Demo report recorded locally and profile blocked. No report was sent to a moderation team."
                : "This profile is blocked and removed from your introductions and connections.",
            );
            setReporting(null);
          }}
        />
      )}
    </AppShell>
  );
}
function MatchCard({
  recommendation: r,
  viewer,
  index,
  decision,
  isMatched,
  hasAgentSession,
  pendingQuestions,
  declinedCount,
  onInterest,
  onPass,
  onInvestigate,
  onCounterpart,
  onReport,
}: {
  recommendation: Recommendation;
  viewer: Profile;
  index: number;
  decision?: string;
  isMatched: boolean;
  hasAgentSession: boolean;
  pendingQuestions: Investigation[];
  declinedCount: number;
  onInterest: () => void;
  onPass: () => void;
  onInvestigate: () => void;
  onCounterpart: (decision: "interested" | "pass") => void;
  onReport: () => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [facts, setFacts] = useState<string[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function explain() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: viewer, b: r.profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFacts(data.facts);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Piper could not highlight these facts.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <MotionCard className="match-card" index={index}>
      <div className="match-portrait">
        <Portrait id={r.profile.id} />
        <span className="portrait-badge">FICTIONAL PROFILE</span>
        <button
          className="safety-button"
          aria-label={`Block or report ${r.profile.name}`}
          onClick={onReport}
        >
          <Flag size={16} />
        </button>
        <div className="portrait-overlay">
          <h2>
            {r.profile.name}
            <span>, {r.profile.age}</span>
          </h2>
          <span>
            <MapPin size={13} />
            {r.profile.city}
            <span className="location-divider">·</span>
            {title(r.profile.intent)}
          </span>
        </div>
      </div>
      <div className="match-card-body">
        <span className="match-label">
          <Sparkles size={14} />
          {r.label}
        </span>
        <p className="match-bio">{r.profile.bio}</p>
        <div className="tag-row">
          {r.commonInterests.slice(0, 3).map((t) => (
            <span key={t}>{title(t)}</span>
          ))}
          {r.commonInterests.length === 0 && (
            <span>Different interests to explore</span>
          )}
        </div>
        <div className="why-card">
          <span>
            <PiperMark />
            WHY THIS INTRODUCTION
          </span>
          <p>{r.evidence.slice(0, 2).join(" ")}</p>
        </div>
        <Link
          className="question-prompt agents-prompt"
          href={`/agents?with=${r.profile.id}`}
        >
          <span className="question-icon">
            <MessagesSquare size={18} />
          </span>
          <span>
            <strong>
              {hasAgentSession ? "See what our AIs found" : "Let our AIs talk"}
            </strong>
            <small>
              {hasAgentSession
                ? "Matchmaker conversation saved"
                : "Two matchmakers · up to 3 questions · approved facts only"}
            </small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        {!!pendingQuestions.length && (
          <button className="question-prompt" onClick={onInvestigate}>
            <span className="question-icon">
              <MessageCircle size={18} />
            </span>
            <span>
              <strong>A question worth asking</strong>
              <small>
                {dimensionLabels[pendingQuestions[0].dimension]} ·{" "}
                {pendingQuestions[0].hard
                  ? "Important preference"
                  : "A little more clarity"}
              </small>
            </span>
            <ArrowUpRight size={18} />
          </button>
        )}
        {!!declinedCount && (
          <p className="declined-note">
            <ShieldCheck size={13} />
            An optional question was declined. We won’t ask it again.
          </p>
        )}
        <button
          className="details-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "A little less detail"
            : "The common ground & the differences"}
          <ChevronDown
            size={15}
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          />
        </button>
        {expanded && (
          <div className="match-details">
            <h3>The common ground</h3>
            <ul>
              {r.evidence.map((e) => (
                <li key={e}>
                  <Check size={13} />
                  {e}
                </li>
              ))}
            </ul>
            <h3>Potential differences</h3>
            {r.differences.length ? (
              <ul>
                {r.differences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : (
              <p>
                No differences were found in the information shared so far.
                There is still more to learn.
              </p>
            )}
            <h3>Still unknown</h3>
            {r.missing.length ? (
              <ul>
                {r.missing.map((q) => (
                  <li key={q.key}>
                    {q.reason}
                    {q.hard
                      ? " This is a hard preference; eligibility is provisional."
                      : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No missing answers for your current compatibility preferences.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void explain()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              Let Piper highlight the key facts
            </Button>
            {facts && (
              <div className="ai-highlight">
                <span>GEMINI-SELECTED · APPROVED FACTS ONLY</span>
                {facts.map((f) => (
                  <p key={f}>{f}</p>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error} The explanation above remains available.
              </p>
            )}
          </div>
        )}
        <div className="match-card-actions">
          {isMatched ? (
            <Button asChild>
              <Link href={`/connections?with=${r.profile.id}`}>
                <MessageCircle size={16} />
                Open your connection
              </Link>
            </Button>
          ) : decision === "interested" ? (
            <div className="synthetic-choice">
              <p>
                <Check size={14} />
                Your interest is saved.
              </p>
              <span>SIMULATE THEIR DECISION · FICTIONAL DEMO</span>
              <div>
                <Button size="sm" onClick={() => onCounterpart("interested")}>
                  Also interested <Heart size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCounterpart("pass")}
                >
                  They pass
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={onPass}>
                <X size={17} />
                Pass
              </Button>
              <Button onClick={onInterest}>
                <Heart size={17} />
                I’m interested
              </Button>
            </>
          )}
        </div>
      </div>
    </MotionCard>
  );
}
export function InvestigationModal({
  recommendation: r,
  viewer,
  handled,
  onClose,
  onResult,
  initialKey,
}: {
  recommendation: Recommendation;
  viewer: Profile;
  handled: Record<string, string>;
  onClose: () => void;
  onResult: (message: string) => void;
  initialKey?: string;
}) {
  const questions = r.missing.filter((q) => !handled[q.key]),
    [index, setIndex] = useState(() =>
      Math.max(
        0,
        questions.findIndex((q) => q.key === initialKey),
      ),
    ),
    [answer, setAnswer] = useState(""),
    [consent, setConsent] = useState(false),
    [generated, setGenerated] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = questions[index];
  if (!q)
    return (
      <Modal title="All caught up" onClose={onClose}>
        <p>No new relevant questions. Declined questions stay private.</p>
      </Modal>
    );
  const subject = q.subjectId === viewer.id ? viewer : r.profile;
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a: viewer,
          b: r.profile,
          dimension: q.dimension,
          subjectId: q.subjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenerated(data.question);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The AI question could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  }
  function respond(share: boolean) {
    try {
      dispatchDemo({
        type: "answer",
        id: r.profile.id,
        subjectId: q.subjectId,
        dimension: q.dimension,
        answer,
        consent: share,
      });
      onResult(
        share
          ? `${subject.name}’s fictional answer was approved for sharing. The profile and ranking have been recalculated; a hard conflict can remove an introduction.`
          : "This question was declined. The answer remains unknown and won’t be requested again.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the answer.");
    }
  }
  return (
    <Modal title="Curiosity, with consent." onClose={onClose}>
      <span className="badge sage">
        <Sparkles size={13} />
        COMPATIBILITY INVESTIGATION
      </span>
      <p>{q.reason}</p>
      {questions.length > 1 && (
        <label>
          Choose a relevant question
          <select
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setGenerated("");
              setAnswer("");
              setConsent(false);
              setError("");
            }}
          >
            {questions.map((q, i) => (
              <option key={q.key} value={i}>
                {dimensionLabels[q.dimension]} ·{" "}
                {q.subjectId === viewer.id
                  ? "For you"
                  : `For ${r.profile.name}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="investigation-question">
        <PiperMark />
        <p>
          {generated ||
            `Would you feel comfortable sharing a little about your ${dimensionLabels[q.dimension].toLowerCase()}? It’s completely okay to skip.`}
        </p>
        <small>
          {generated
            ? "Generated by Gemini"
            : "Standard question · not AI generated"}
        </small>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        Ask Piper to phrase the question
      </Button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="simulation-box">
        <span className="eyebrow">
          SIMULATE {subject.name.toUpperCase()}’S CHOICE
        </span>
        <p>
          This is a fictional demonstration. You control the simulated answer;
          no real person is being contacted.
        </p>
        <label>
          {dimensionLabels[q.dimension]}
          <select value={answer} onChange={(e) => setAnswer(e.target.value)}>
            <option value="">Choose a fictional answer</option>
            {dimensionOptions[q.dimension].map((v) => (
              <option key={v} value={v}>
                {attributeLabel(q.dimension, v)}
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Simulate {subject.name}’s explicit approval to share this answer
        </label>
        <div className="inline-actions">
          <Button disabled={!answer || !consent} onClick={() => respond(true)}>
            Share & update introduction <ArrowRight size={15} />
          </Button>
          <Button variant="ghost" onClick={() => respond(false)}>
            Decline to answer
          </Button>
        </div>
      </div>
      <p className="fine-print">
        <ShieldCheck size={14} />
        Private interviews are never revealed. Only the approved answer updates
        the profile.
      </p>
    </Modal>
  );
}
export function SafetyModal({
  name,
  onClose,
  onSubmit,
  real = false,
}: {
  name: string;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
  real?: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Your space, your boundaries.`} onClose={onClose}>
      <p>
        Blocking {name} removes this person from your introductions and prevents
        messaging.
      </p>
      <label>
        Report a concern (optional)
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Block without a report</option>
          <option>Inappropriate behavior</option>
          <option>Misleading profile</option>
          <option>Safety concern</option>
        </select>
      </label>
      <p className="fine-print">
        {real
          ? "A report will be stored privately for the platform operator to review."
          : "Demo reports are recorded only in this browser. They are not sent to a moderation team."}
      </p>
      <Button
        variant="destructive"
        onClick={() => onSubmit(reason || undefined)}
      >
        <ShieldCheck size={17} />
        {reason ? "Record report & block" : "Block profile"}
      </Button>
    </Modal>
  );
}
