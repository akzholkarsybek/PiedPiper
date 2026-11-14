"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Heart,
  Layers,
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
  Leaf,
  CalendarRange,
  UsersRound,
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
  exclusionSummary,
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

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const genderWord = (g: Profile["gender"]) =>
  g === "woman" ? "Women" : g === "man" ? "Men" : "Non-binary people";

export function Discover() {
  const state = useDemo(),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState<"all" | "questions" | "interested">("all");
  const [investigating, setInvestigating] = useState<string | null>(null),
    [passing, setPassing] = useState<string | null>(null),
    [reporting, setReporting] = useState<string | null>(null),
    [featuredId, setFeaturedId] = useState<string | null>(null);
  const [reason, setReason] = useState("Not the connection I’m looking for"),
    [prioritize, setPrioritize] = useState(false),
    [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    if (state.profile?.approved && state.introducedIds.length === 0) {
      const ids = recommend(state.profile, state.candidates, state.weights)
        .filter(
          (r) =>
            state.decisions[r.profile.id] !== "pass" &&
            state.counterparts[r.profile.id] !== "pass",
        )
        .slice(0, 3)
        .map((r) => r.profile.id);
      if (ids.length) dispatchDemo({ type: "introductions", ids });
    }
  }, [
    state.profile,
    state.candidates,
    state.weights,
    state.decisions,
    state.counterparts,
    state.introducedIds,
  ]);
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
  const collection = available.filter((r) =>
    state.introducedIds.includes(r.profile.id),
  );
  const filtered = collection.filter((r) =>
    filter === "questions"
      ? r.missing.some((q) => !state.questions[q.key])
      : filter === "interested"
        ? state.decisions[r.profile.id] === "interested"
        : true,
  );
  const featured =
    filtered.find((r) => r.profile.id === featuredId) ?? filtered[0];
  const others = filtered.filter((r) => r !== featured);
  const selected = ranked.find((r) => r.profile.id === investigating);
  const viewed = collection.find((r) => r.profile.id === viewing)?.profile;
  const nextBatch = available
    .filter((r) => !state.introducedIds.includes(r.profile.id))
    .slice(0, Math.min(3, 6 - state.introducedIds.length));
  function act(fn: () => void, message: string) {
    try {
      fn();
      setNotice(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    }
  }
  const prefs = profile.preferences;
  return (
    <AppShell>
      <div className="page-heading dc-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-star" aria-hidden="true">
              ✳
            </span>
            Discover · curated introductions
          </span>
          <h1>
            Discover people who <em>feel right.</em>
          </h1>
          <p>
            {profile.name}, a small set of people chosen by your AI matchmaker
            from shared values, interests and what you’re both looking for.
            Never an endless feed.
          </p>
        </div>
      </div>
      <div className="dc-filters" aria-label="Your matching preferences">
        <Link href="/profile" className="pill" title="Edit in My Profile">
          <MapPin size={15} />
          {prefs.locationMode === "local"
            ? `Near ${profile.city || "you"}`
            : "Any city"}
        </Link>
        <Link href="/profile" className="pill" title="Edit in My Profile">
          <Heart size={15} />
          {title(profile.intent)}
          {prefs.strictIntent ? " only" : ""}
        </Link>
        <Link href="/profile" className="pill" title="Edit in My Profile">
          <CalendarRange size={15} />
          Age {prefs.minAge}–{prefs.maxAge}
        </Link>
        <Link href="/profile" className="pill" title="Edit in My Profile">
          <UsersRound size={15} />
          {prefs.genders.length
            ? prefs.genders.map(genderWord).join(", ")
            : "Anyone"}
        </Link>
        <Link
          href="/profile"
          className="pill dc-edit"
          title="Edit in My Profile"
        >
          <SlidersHorizontal size={15} />
          Edit preferences
        </Link>
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
      <div className="dc-toolbar">
        <div
          className="segmented"
          role="group"
          aria-label="Filter introductions"
        >
          <button
            className={filter === "all" ? "active" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            For you <span>{collection.length}</span>
          </button>
          <button
            className={filter === "questions" ? "active" : ""}
            aria-pressed={filter === "questions"}
            onClick={() => setFilter("questions")}
          >
            A question to explore
          </button>
          <button
            className={filter === "interested" ? "active" : ""}
            aria-pressed={filter === "interested"}
            onClick={() => setFilter("interested")}
          >
            Your interest
          </button>
        </div>
        <span className="dc-count">
          <Sparkles size={14} />
          {state.introducedIds.length} of 6 introductions in this collection
        </span>
      </div>
      {!filtered.length || !featured ? (
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
          {!paused && ranked.length === 0 && (
            <div className="binding-constraints">
              <p>
                Across {state.candidates.length} fictional profiles, these rules
                exclude candidates (counts overlap):
              </p>
              <ul>
                {exclusionSummary(profile, state.candidates).map((x) => (
                  <li key={x.reason}>
                    {x.reason}: {x.count}
                  </li>
                ))}
              </ul>
              <p>
                All requirements remain in place. You can choose whether to
                change any preference.
              </p>
            </div>
          )}
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
        <div className={`dc-stage ${others.length ? "" : "solo"}`}>
          <FeaturedCard
            key={
              featured.profile.id + JSON.stringify(featured.profile.attributes)
            }
            recommendation={featured}
            isTop={featured === filtered[0] && filter === "all"}
            onView={() => setViewing(featured.profile.id)}
            viewer={profile}
            decision={state.decisions[featured.profile.id]}
            isMatched={matched(state, featured.profile.id)}
            hasAgentSession={!!state.agentSessions[featured.profile.id]}
            pendingQuestions={featured.missing.filter(
              (q) => !state.questions[q.key],
            )}
            declinedCount={
              featured.missing.filter(
                (q) => state.questions[q.key] === "declined",
              ).length
            }
            onInterest={() =>
              act(
                () =>
                  dispatchDemo({
                    type: "decision",
                    id: featured.profile.id,
                    decision: "interested",
                  }),
                `Your interest in ${featured.profile.name} is saved. A connection needs their interest too.`,
              )
            }
            onPass={() => {
              setPassing(featured.profile.id);
              setPrioritize(false);
            }}
            onInvestigate={() => setInvestigating(featured.profile.id)}
            onCounterpart={(decision) =>
              act(
                () =>
                  dispatchDemo({
                    type: "counterpart",
                    id: featured.profile.id,
                    decision,
                  }),
                decision === "interested"
                  ? `Demo: ${featured.profile.name} also expressed interest. Your messaging space is open.`
                  : `Demo: ${featured.profile.name} passed. No connection was created.`,
              )
            }
            onReport={() => setReporting(featured.profile.id)}
          />
          {others.length > 0 && (
            <aside className="dc-queue" aria-label="More introductions">
              <h3 className="dc-queue-title">Also in your collection</h3>
              {others.map((r, i) => (
                <MiniCard
                  key={r.profile.id}
                  recommendation={r}
                  index={i}
                  status={
                    matched(state, r.profile.id)
                      ? "Connected"
                      : state.decisions[r.profile.id] === "interested"
                        ? "Your interest is saved"
                        : state.agentSessions[r.profile.id]
                          ? "AIs have talked"
                          : null
                  }
                  onSelect={() => {
                    setFeaturedId(r.profile.id);
                    document
                      .getElementById("main")
                      ?.scrollIntoView({ block: "start", behavior: "smooth" });
                  }}
                />
              ))}
            </aside>
          )}
        </div>
      )}
      {nextBatch.length > 0 && (
        <div className="load-more">
          <Button
            variant="outline"
            onClick={() =>
              act(
                () =>
                  dispatchDemo({
                    type: "introductions",
                    ids: nextBatch.map((r) => r.profile.id),
                  }),
                "The next small batch was selected using the same reciprocal requirements.",
              )
            }
          >
            Meet the next {nextBatch.length} <ArrowRight size={16} />
          </Button>
          <p>Up to six thoughtful introductions. Then take a breath.</p>
        </div>
      )}
      {state.introducedIds.length === 6 && (
        <p className="collection-limit">
          Your collection of six introductions is ready. Take time to explore
          these people or review your preferences.
        </p>
      )}
      {viewed && (
        <Modal
          title={`${viewed.name}, ${viewed.age} · fictional profile`}
          onClose={() => setViewing(null)}
        >
          <div className="profile-modal-head">
            <div className="profile-modal-photo">
              <Portrait
                id={viewed.id}
                gender={viewed.gender}
                age={viewed.age}
              />
            </div>
            <p>
              {viewed.city} · {title(viewed.gender)} · {title(viewed.intent)}
            </p>
          </div>
          <p>{viewed.bio}</p>
          <h3>Approved interests & values</h3>
          <p>{viewed.interests.join(", ")}</p>
          <p>{viewed.values.join(", ")}</p>
          <h3>Shared lifestyle facts</h3>
          {Object.entries(viewed.attributes).map(([d, v]) => (
            <p key={d}>
              {dimensionLabels[d as keyof typeof dimensionLabels]}:{" "}
              {attributeLabel(d as keyof typeof dimensionLabels, v)}
            </p>
          ))}
          <Link
            className="button button-primary"
            href={`/agents?with=${viewed.id}`}
          >
            Let our AIs talk <MessagesSquare size={16} />
          </Link>
        </Modal>
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

function MiniCard({
  recommendation: r,
  index,
  status,
  onSelect,
}: {
  recommendation: Recommendation;
  index: number;
  status: string | null;
  onSelect: () => void;
}) {
  const p = r.profile;
  return (
    <MotionCard className="dc-mini" index={index + 1}>
      <div className="dc-mini-photo">
        <Portrait id={p.id} gender={p.gender} age={p.age} />
      </div>
      <div className="dc-mini-body">
        <h2>
          {p.name}
          <span>, {p.age}</span>
        </h2>
        <span className="dc-mini-meta">
          <MapPin size={13} />
          {p.city}
        </span>
        <span className="dc-mini-tags">
          {(r.commonInterests.length ? r.commonInterests : p.interests)
            .slice(0, 3)
            .map(title)
            .join(" · ")}
        </span>
        {status && (
          <span className="dc-mini-status">
            <Check size={12} /> {status}
          </span>
        )}
      </div>
      <button
        type="button"
        className="dc-mini-open"
        aria-label={`View ${p.name}’s introduction`}
        onClick={onSelect}
      >
        <ArrowRight size={18} />
      </button>
    </MotionCard>
  );
}

function FeaturedCard({
  recommendation: r,
  viewer,
  isTop,
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
  onView,
}: {
  recommendation: Recommendation;
  viewer: Profile;
  isTop: boolean;
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
  onView: () => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [facts, setFacts] = useState<string[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const p = r.profile;
  async function explain() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: viewer, b: p }),
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
  const shared = new Set(r.commonInterests);
  const sameIntent = !!viewer.intent && viewer.intent === p.intent;
  return (
    <MotionCard className="dc-feature" index={0}>
      <div className="dc-profile">
        <div className="dc-photo">
          <Portrait id={p.id} gender={p.gender} age={p.age} />
          <span className="dc-photo-badge">
            <Sparkles size={14} />
            {isTop ? "Top introduction for you" : r.label}
          </span>
          <span className="dc-photo-note">Fictional profile · illustrated</span>
          <button
            className="dc-flag"
            aria-label={`Block or report ${p.name}`}
            onClick={onReport}
          >
            <Flag size={16} />
          </button>
        </div>
        <div className="dc-info">
          <header>
            <h2>
              {p.name}
              <span>, {p.age}</span>
            </h2>
            <ul className="dc-meta">
              <li>
                <MapPin size={15} />
                {p.city}
              </li>
              <li>
                <Heart size={15} />
                {title(p.intent)}
              </li>
              {p.attributes.pace && (
                <li>
                  <Leaf size={15} />
                  {title(p.attributes.pace)} pace
                </li>
              )}
            </ul>
          </header>
          <div className="dc-prompts">
            {p.bio && (
              <div className="dc-prompt">
                <span>In {p.name}’s words</span>
                <p>{p.bio}</p>
              </div>
            )}
            {p.interests.length > 0 && (
              <div className="dc-prompt">
                <span>I’m into</span>
                <div className="tag-row dc-tags">
                  {p.interests.map((t) => (
                    <span key={t} className={shared.has(t) ? "shared" : ""}>
                      {shared.has(t) && <Check size={12} />}
                      {title(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {p.values.length > 0 && (
              <div className="dc-prompt">
                <span>What matters to me</span>
                <p>{list(p.values.map((v) => v.toLowerCase()))}</p>
              </div>
            )}
          </div>
          <button type="button" className="text-link" onClick={onView}>
            Open approved profile <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      <section className="dc-why" aria-label={`Why Piper introduced ${p.name}`}>
        <header>
          <h3>
            Why Piper introduced <em>{p.name}.</em>
          </h3>
          <span className="dc-why-tag">
            <PiperMark /> {r.label}
          </span>
        </header>
        <div className="dc-why-grid">
          <div>
            <h4>
              <Leaf size={17} /> Shared interests
            </h4>
            <p>
              {r.commonInterests.length
                ? `You both enjoy ${list(r.commonInterests.map((t) => t.toLowerCase()))}.`
                : "No shared interests yet: different interests to explore."}
            </p>
          </div>
          <div>
            <h4>
              <Heart size={17} /> Aligned intentions
            </h4>
            <p>
              {sameIntent
                ? `You’re both looking for ${title(p.intent).toLowerCase()}.`
                : `You: ${title(viewer.intent).toLowerCase()}. ${p.name}: ${title(p.intent).toLowerCase()}.`}
              {r.commonValues.length > 0 &&
                ` You both value ${list(r.commonValues.map((v) => v.toLowerCase()))}.`}
            </p>
          </div>
          <div>
            <h4>
              <Layers size={17} /> Possible differences
            </h4>
            {r.differences.length ? (
              <p>{r.differences.slice(0, 2).join(" ")}</p>
            ) : (
              <p>
                None found in what’s been shared so far. There’s still more to
                learn.
              </p>
            )}
          </div>
          <div>
            <h4>
              <CircleHelp size={17} /> Unresolved question
            </h4>
            {pendingQuestions.length ? (
              <>
                <p>{pendingQuestions[0].reason}</p>
                <button className="dc-ask" onClick={onInvestigate}>
                  <MessageCircle size={16} />
                  <span>
                    A question worth asking
                    <small>
                      {dimensionLabels[pendingQuestions[0].dimension]} ·{" "}
                      {pendingQuestions[0].hard
                        ? "Important preference"
                        : "A little more clarity"}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </>
            ) : (
              <p>
                Nothing important is unknown for either person’s preferences.
              </p>
            )}
            {!!declinedCount && (
              <p className="declined-note">
                <ShieldCheck size={13} />
                An optional question was declined. We won’t ask it again.
              </p>
            )}
          </div>
        </div>
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
      </section>

      <div className="dc-actions">
        <Link
          className="button button-primary button-lg dc-talk"
          href={`/agents?with=${p.id}`}
        >
          <Sparkles size={18} />
          {hasAgentSession ? "See what our AIs found" : "Let our AIs talk"}
          <ArrowRight size={18} />
        </Link>
        {isMatched ? (
          <Button asChild size="lg" variant="secondary">
            <Link href={`/connections?with=${p.id}`}>
              <MessageCircle size={17} />
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
            <Button variant="outline" size="lg" onClick={onPass}>
              <X size={18} />
              Pass
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="dc-interested"
              onClick={onInterest}
            >
              <Heart size={18} />
              I’m interested
            </Button>
          </>
        )}
      </div>
      <p className="dc-action-note">
        {hasAgentSession
          ? "Matchmaker conversation saved."
          : "Two matchmakers · 2–3 focused rounds · approved facts only."}{" "}
        {p.name} only sees your interest if it’s mutual.
      </p>
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
