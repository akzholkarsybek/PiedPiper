"use client";
import { useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  Clock,
  Coffee,
  Footprints,
  Landmark,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Utensils,
  Heart,
} from "lucide-react";
import { Button } from "./ui/button";
import { AvailabilityEditor } from "./availability-editor";
import { dispatchDemo, GUEST_ID, type DemoState } from "@/lib/demo-store";
import { samplePlanning } from "@/lib/fixtures";
import type { Profile } from "@/lib/profile";
import {
  computeOverlap,
  dateCategoryLabels,
  formatWindow,
  proposalSlot,
  proposalStatusLabel,
  type DateCategory,
  type Planning,
} from "@/lib/planning";
import {
  buildDateContext,
  dateIdeasResultSchema,
  templateIdeas,
  type DateIdea,
} from "@/lib/dates";

const categoryIcon: Record<DateCategory, typeof Coffee> = {
  coffee: Coffee,
  restaurant: Utensils,
  museum: Landmark,
  walk: Footprints,
  sport: Trophy,
  "cultural-event": Ticket,
  "shared-interest": Heart,
};
function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function DatePlanner({
  state,
  profile,
  peer,
}: {
  state: DemoState;
  profile: Profile;
  peer: Profile;
}) {
  // A stable reference instant keeps the computed windows steady while open.
  const [from] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });
  const mine = state.planning[GUEST_ID],
    theirs = state.planning[peer.id];
  const overlap = computeOverlap(mine?.availability, theirs?.availability, {
    from,
  });
  const windows = overlap.status === "ok" ? overlap.windows : [];
  const tz = mine?.availability?.timeZone ?? browserZone();
  const context = buildDateContext(
    profile,
    peer,
    { a: mine ?? null, b: theirs ?? null },
    windows,
    tz,
  );
  const factLabels = new Map(context.facts.map((f) => [f.id, f]));
  const ideas = state.dateIdeas[peer.id];
  const proposals = state.proposals
    .filter((p) => p.peerId === peer.id)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const [editing, setEditing] = useState(false),
    [windowIndex, setWindowIndex] = useState<number | null>(null),
    [ideaIndex, setIdeaIndex] = useState<number | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const act = (fn: () => void, message = "") => {
    try {
      fn();
      setError("");
      setInfo(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  };
  const savePlanning = (p: Planning, message = "") =>
    act(() => dispatchDemo({ type: "planning", planning: p }), message);

  async function geminiIdeas() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a: profile,
          b: peer,
          planning: { a: mine ?? null, b: theirs ?? null },
          mutualConfirmed: true,
          processingConsent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No ideas this time.");
      const result = dateIdeasResultSchema.parse({
        ideas: data.ideas,
        generatedAt: new Date().toISOString(),
        notice: data.notice ?? null,
      });
      act(() => dispatchDemo({ type: "date-ideas", id: peer.id, result }));
      setIdeaIndex(null);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Gemini could not suggest ideas."} You can use template ideas instead.`,
      );
    } finally {
      setBusy(false);
    }
  }
  function applyTemplates() {
    const result = {
      ideas: templateIdeas(context),
      generatedAt: new Date().toISOString(),
      notice:
        "Template suggestions based on your shared facts · not AI-generated.",
    };
    act(() => dispatchDemo({ type: "date-ideas", id: peer.id, result }));
    setIdeaIndex(null);
  }
  const chosenIdea: DateIdea | undefined =
    ideaIndex !== null ? ideas?.ideas[ideaIndex] : undefined;
  const chosenWindow = windowIndex !== null ? windows[windowIndex] : undefined;

  return (
    <section className="date-planner" id="plan" aria-labelledby="plan-title">
      <div className="date-planner-head">
        <span className="eyebrow">
          <CalendarHeart size={13} /> AFTER A MUTUAL YES
        </span>
        <h2 id="plan-title">
          Your first date, <em>made easier.</em>
        </h2>
        <p>
          Your matchmakers compare general availability and suggest activity
          types. Nothing is booked, and nothing is confirmed until you both say
          yes.
        </p>
      </div>
      {info && (
        <p role="status" className="saved-text">
          <BadgeCheck size={14} /> {info}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="planner-grid">
        <div className="planner-card">
          <h3>
            <CalendarDays size={17} /> When could you meet?
          </h3>
          {overlap.status === "ok" ? (
            <>
              <p className="muted">
                Overlapping general availability this week · times in{" "}
                {tz.replaceAll("_", " ")}
              </p>
              <div
                className="window-options"
                role="radiogroup"
                aria-label="Shared time windows"
              >
                {windows.map((w, i) => (
                  <button
                    key={w.start}
                    role="radio"
                    aria-checked={windowIndex === i}
                    className={windowIndex === i ? "selected" : ""}
                    onClick={() => setWindowIndex(i)}
                  >
                    <Clock size={13} /> {formatWindow(w, tz)}
                  </button>
                ))}
              </div>
              <small className="fine-print">
                <ShieldCheck size={13} /> Shown because you both chose to share.{" "}
                {peer.name}’s consent is part of the fictional demo data.
              </small>
            </>
          ) : (
            <OverlapMessage
              overlap={overlap}
              peerName={peer.name}
              onShare={() =>
                mine &&
                savePlanning(
                  {
                    ...mine,
                    availability: mine.availability && {
                      ...mine.availability,
                      shareWithMatches: true,
                    },
                  },
                  "Your general availability is now shared with mutual connections.",
                )
              }
              onAdd={() => setEditing(true)}
            />
          )}
          <div className="inline-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Close editor" : "Edit my availability"}
            </Button>
            {mine?.availability?.shareWithMatches && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  savePlanning(
                    {
                      ...mine,
                      availability: mine.availability && {
                        ...mine.availability,
                        shareWithMatches: false,
                      },
                    },
                    "Sharing turned off. Open proposals that relied on it were withdrawn.",
                  )
                }
              >
                Stop sharing my availability
              </Button>
            )}
          </div>
          {editing && (
            <AvailabilityEditor
              compact
              value={mine}
              sample={samplePlanning}
              onSave={(p) => {
                savePlanning(p);
                setWindowIndex(null);
              }}
            />
          )}
        </div>
        <div className="planner-card">
          <h3>
            <Sparkles size={17} /> First-date ideas
          </h3>
          {!ideas ? (
            <>
              <p className="muted">
                Based on confirmed shared interests, stated activity preferences
                and budget, and your overlap. Activity types only: no invented
                venues, prices or opening hours.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Send these fictional preferences to Gemini for ideas.
              </label>
              <div className="inline-actions">
                <Button
                  disabled={!consent || busy}
                  onClick={() => void geminiIdeas()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  Ask our matchmakers for ideas
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={applyTemplates}
                >
                  Use template ideas (no AI)
                </Button>
              </div>
            </>
          ) : (
            <>
              <div
                className="idea-list"
                role="radiogroup"
                aria-label="First-date ideas"
              >
                {ideas.ideas.map((idea, i) => {
                  const Icon = categoryIcon[idea.category];
                  const fit =
                    idea.windowIndex !== null
                      ? context.windows[idea.windowIndex]?.label
                      : undefined;
                  return (
                    <button
                      key={`${idea.category}-${i}`}
                      role="radio"
                      aria-checked={ideaIndex === i}
                      className={`idea-card ${ideaIndex === i ? "selected" : ""}`}
                      onClick={() => {
                        setIdeaIndex(i);
                        if (
                          idea.windowIndex !== null &&
                          idea.windowIndex < windows.length &&
                          windowIndex === null
                        )
                          setWindowIndex(idea.windowIndex);
                      }}
                    >
                      <span className="idea-icon">
                        <Icon size={18} />
                      </span>
                      <span className="idea-body">
                        <span className="idea-meta">
                          {dateCategoryLabels[idea.category]}
                          <em>
                            {idea.source === "gemini"
                              ? "GEMINI · VERIFIED"
                              : "TEMPLATE · NOT AI"}
                          </em>
                        </span>
                        <strong>{idea.title}</strong>
                        <span>{idea.why}</span>
                        <span className="idea-evidence">
                          {idea.evidence
                            .map((id) => factLabels.get(id)?.value)
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((v) => (
                              <small key={v}>
                                <BadgeCheck size={10} /> {v}
                              </small>
                            ))}
                          {fit && (
                            <small>
                              <Clock size={10} /> Fits {fit}
                            </small>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {ideas.notice && <p className="fine-print">{ideas.notice}</p>}
              <div className="inline-actions">
                <Button size="sm" variant="ghost" onClick={applyTemplates}>
                  Template ideas
                </Button>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  Use Gemini
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!consent || busy}
                  onClick={() => void geminiIdeas()}
                >
                  {busy && <LoaderCircle className="spin" size={13} />} New
                  Gemini ideas
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="proposal-panel">
        <h3>
          <CalendarCheck size={17} /> Propose a plan
        </h3>
        <p className="muted">
          {chosenIdea && chosenWindow
            ? `${chosenIdea.title} · ${formatWindow(proposalSlot(chosenWindow), tz)}`
            : "Choose a shared time and an idea above. A proposal is not a confirmed date until both of you accept."}
        </p>
        <Button
          disabled={!chosenIdea || !chosenWindow}
          onClick={() => {
            if (!chosenIdea || !chosenWindow) return;
            const slot = proposalSlot(chosenWindow);
            act(
              () =>
                dispatchDemo({
                  type: "propose",
                  id: peer.id,
                  activity: {
                    category: chosenIdea.category,
                    title: chosenIdea.title.slice(0, 100),
                  },
                  start: slot.start,
                  end: slot.end,
                  now: from.toISOString(),
                }),
              `Proposal sent to ${peer.name}. It is not a confirmed date until ${peer.name} accepts.`,
            );
          }}
        >
          Propose this plan to {peer.name}
        </Button>
        {!!proposals.length && (
          <ul className="proposal-list">
            {proposals.slice(0, 4).map((p) => (
              <li key={p.id} className={`proposal ${p.status}`}>
                <div>
                  <strong>{p.activity.title}</strong>
                  <span>{formatWindow(p, tz)}</span>
                  <span className={`proposal-status ${p.status}`}>
                    {proposalStatusLabel(p)}
                  </span>
                  {p.status === "accepted" && (
                    <small>
                      Nothing has been booked. Choose a public place together
                      and let a friend know your plans.
                    </small>
                  )}
                </div>
                {(p.status === "proposed" || p.status === "accepted") && (
                  <div className="proposal-actions">
                    {p.status === "proposed" && (
                      <div className="synthetic-choice">
                        <span>
                          SIMULATE {peer.name.toUpperCase()}’S RESPONSE ·
                          FICTIONAL
                        </span>
                        <div>
                          <Button
                            size="sm"
                            onClick={() =>
                              act(
                                () =>
                                  dispatchDemo({
                                    type: "proposal-response",
                                    id: peer.id,
                                    proposalId: p.id,
                                    response: "accepted",
                                  }),
                                `Demo: ${peer.name} accepted. Your first date is confirmed by both (simulated).`,
                              )
                            }
                          >
                            {peer.name} accepts
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              act(
                                () =>
                                  dispatchDemo({
                                    type: "proposal-response",
                                    id: peer.id,
                                    proposalId: p.id,
                                    response: "declined",
                                  }),
                                `Demo: ${peer.name} declined this time. You can propose another plan.`,
                              )
                            }
                          >
                            {peer.name} declines
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        act(
                          () =>
                            dispatchDemo({
                              type: "withdraw-proposal",
                              id: peer.id,
                              proposalId: p.id,
                            }),
                          "Proposal withdrawn.",
                        )
                      }
                    >
                      {p.status === "accepted"
                        ? "Cancel this date"
                        : "Withdraw"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OverlapMessage({
  overlap,
  peerName,
  onShare,
  onAdd,
}: {
  overlap: Exclude<ReturnType<typeof computeOverlap>, { status: "ok" }>;
  peerName: string;
  onShare: () => void;
  onAdd: () => void;
}) {
  if (overlap.status === "missing")
    return overlap.who.includes("a") ? (
      <div className="overlap-empty">
        <p>
          You haven’t added general availability yet. We never assume when
          anyone is free.
        </p>
        <Button size="sm" onClick={onAdd}>
          Add my general availability
        </Button>
      </div>
    ) : (
      <p className="overlap-empty">
        {peerName} hasn’t entered availability, so we won’t guess. You can still
        message to find a time.
      </p>
    );
  if (overlap.status === "not-shared")
    return overlap.who.includes("a") ? (
      <div className="overlap-empty">
        <p>
          Your availability is private. Share it with mutual connections to
          compare times.
        </p>
        <Button size="sm" onClick={onShare}>
          Share my availability with mutual connections
        </Button>
      </div>
    ) : (
      <p className="overlap-empty">
        {peerName} hasn’t chosen to share availability (fictional), so no times
        are shown.
      </p>
    );
  if (overlap.status === "not-open")
    return (
      <p className="overlap-empty">
        {overlap.who.includes("a")
          ? "You said you’re not looking to meet right now. Update your availability when you are."
          : `${peerName} isn’t looking to meet soon (fictional). No times are suggested.`}
      </p>
    );
  return (
    <p className="overlap-empty">
      No overlapping windows this week. Try adding a few more general times, or
      find a time by message.
    </p>
  );
}
