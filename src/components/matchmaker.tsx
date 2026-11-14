"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CirclePause,
  CirclePlay,
  LoaderCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell, NoProfile } from "./app-shell";
import { PiperMark } from "./brand";
import { Button } from "./ui/button";
import { AvailabilityEditor } from "./availability-editor";
import { PhotoSuggestions } from "./photo-suggestions";
import {
  dispatchDemo,
  GUEST_ID,
  matched,
  useDemo,
  type DemoState,
} from "@/lib/demo-store";
import { samplePlanning } from "@/lib/fixtures";
import { recommend } from "@/lib/matching";
import { dateCategoryLabels, type DateCategory } from "@/lib/planning";
import {
  enrichmentInputSchema,
  keywordSuggestions,
  suggestionSchema,
  type EnrichmentInput,
  type Suggestion,
} from "@/lib/enrichment";

export function Matchmaker() {
  const state = useDemo(),
    [notice, setNotice] = useState("");
  if (!state.profile?.approved)
    return (
      <AppShell>
        <NoProfile />
      </AppShell>
    );
  const profile = state.profile;
  const ready = profile.readyToConnect !== false;
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MY AI MATCHMAKER</span>
          <h1>
            Your matchmaker, <em>working for you.</em>
          </h1>
          <p>
            Piper finds the people. You build the relationship. Here’s what
            Piper knows, and what you’ve allowed it to share.
          </p>
        </div>
        <Link href="/onboarding?demo=1" className="preference-link">
          <PiperMark /> Talk to Piper again
        </Link>
      </div>
      <Journey state={state} />
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
      <section className={`ready-card ${ready ? "on" : "off"}`}>
        <div>
          <span className="eyebrow">READY TO CONNECT</span>
          <h2>{ready ? "Open to new introductions." : "Taking a pause."}</h2>
          <p>
            {ready
              ? "Piper can introduce you to eligible people, and you can appear in their introductions."
              : "You won’t receive or appear in new introductions. Existing connections and messages are preserved."}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={ready}
          aria-label="Ready to Connect"
          className="switch"
          onClick={() => {
            try {
              dispatchDemo({ type: "ready", ready: !ready });
              setNotice(
                ready
                  ? "Paused. You’re out of new introductions until you resume."
                  : "Resumed. New introductions are open again.",
              );
            } catch (e) {
              setNotice(e instanceof Error ? e.message : "Please try again.");
            }
          }}
        >
          <span />
          {ready ? <CirclePlay size={15} /> : <CirclePause size={15} />}
          {ready ? "On" : "Paused"}
        </button>
      </section>
      <section className="matchmaker-section">
        <div className="section-intro">
          <h2>
            When you’re free, <em>roughly.</em>
          </h2>
          <p>
            Optional. General weekly windows and first-date preferences help
            your matchmaker suggest a time and an activity after a mutual yes.
          </p>
        </div>
        <AvailabilityEditor
          value={state.planning[GUEST_ID]}
          sample={samplePlanning}
          onSave={(planning) => dispatchDemo({ type: "planning", planning })}
        />
      </section>
      <Enrichment state={state} />
    </AppShell>
  );
}

function Journey({ state }: { state: DemoState }) {
  const profile = state.profile!;
  const matchedIds = state.candidates
    .filter((c) => matched(state, c.id))
    .map((c) => c.id);
  const firstPeer =
    Object.keys(state.agentSessions)[0] ??
    recommend(profile, state.candidates, state.weights)[0]?.profile.id;
  const steps = [
    {
      label: "Talk to Piper",
      done: profile.approved,
      href: "/onboarding?demo=1",
    },
    {
      label: "Thoughtful introductions",
      done: recommend(profile, state.candidates, state.weights).length > 0,
      href: "/discover",
    },
    {
      label: "Let the AIs talk",
      done: Object.keys(state.agentSessions).length > 0,
      href: firstPeer ? `/agents?with=${firstPeer}` : "/agents",
    },
    {
      label: "A mutual yes",
      done: matchedIds.length > 0,
      href: "/connections",
    },
    {
      label: "Compare availability",
      done:
        !!state.planning[GUEST_ID]?.availability?.shareWithMatches &&
        matchedIds.length > 0,
      href: matchedIds[0]
        ? `/connections?with=${matchedIds[0]}#plan`
        : "/connections",
    },
    {
      label: "Plan a first date",
      done: state.proposals.some((p) => p.status !== "withdrawn"),
      href: matchedIds[0]
        ? `/connections?with=${matchedIds[0]}#plan`
        : "/connections",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="journey" aria-label="Your Pied Piper journey">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={s.done ? "done" : i === current ? "current" : ""}
        >
          <Link href={s.href}>
            <span>{s.done ? <Check size={12} /> : i + 1}</span>
            {s.label}
          </Link>
        </li>
      ))}
    </ol>
  );
}

const fields: { key: keyof EnrichmentInput; label: string; hint: string }[] = [
  { key: "bio", label: "In your own words", hint: "A few sentences about you" },
  {
    key: "interests",
    label: "Interests & hobbies",
    hint: "What you love doing",
  },
  {
    key: "music",
    label: "Favorite artists & music",
    hint: "Genres or artists",
  },
  {
    key: "activities",
    label: "Favorite activities",
    hint: "Weekends, evenings, trips",
  },
  {
    key: "captions",
    label: "Captions you’ve written",
    hint: "Paste your own captions, not someone else’s",
  },
];
const kindLabel: Record<Suggestion["kind"], string> = {
  interest: "New interest",
  activity: "First-date activity",
  topic: "Conversation starter",
  summary: "Profile summary",
};

const emptyInput = (): EnrichmentInput => ({
  bio: "",
  interests: "",
  music: "",
  activities: "",
  captions: "",
});
/** Fictional content for the guest demo (never a real person's posts). */
const fictionalSample = (): EnrichmentInput => ({
  bio: "Weekday architect, weekend explorer. I like slow mornings with good coffee and long walks along the river.",
  interests:
    "Bouldering twice a week, film photography, trying every new noodle place.",
  music: "Film scores, a bit of jazz, and any live show with a string section.",
  activities:
    "Saturday hikes outside the city, Sunday gallery visits, cooking for friends.",
  captions:
    "Caught the last light from the trail today 🌄 · Third pottery class, still lopsided · Live soundtrack night was unreal",
});
function Enrichment({ state }: { state: DemoState }) {
  const profile = state.profile!;
  const [input, setInput] = useState<EnrichmentInput>(emptyInput),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const existing = {
    interests: profile.interests,
    activityTypes:
      state.planning[GUEST_ID]?.datePreferences.activityTypes ?? [],
  };
  const pending = state.enrichment.filter((s) => s.status === "pending");
  const reviewed = state.enrichment.filter((s) => s.status !== "pending");
  const valid = enrichmentInputSchema.safeParse(input).success;
  function store(suggestions: Suggestion[], message: string) {
    dispatchDemo({ type: "enrichment-suggestions", suggestions });
    setInfo(
      suggestions.length
        ? message
        : "No new suggestions this time. Nothing was changed.",
    );
  }
  async function askGemini() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          existing,
          adultConfirmed: true,
          processingConsent: true,
          mode: "demo",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No suggestions this time.");
      const suggestions = (data.suggestions as unknown[]).map((s) =>
        suggestionSchema.parse(s),
      );
      store(
        suggestions,
        `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} ready for your review. Nothing has been added yet.`,
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Gemini is unavailable."} You can use keyword suggestions instead.`,
      );
    } finally {
      setBusy(false);
    }
  }
  function decide(id: string, approve: boolean) {
    try {
      dispatchDemo({ type: "enrichment-decision", suggestionId: id, approve });
      setError("");
      setInfo(
        approve ? "Added to your profile." : "Dismissed. Nothing was changed.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }
  return (
    <section
      className="matchmaker-section enrichment"
      aria-labelledby="enrich-title"
    >
      <div className="section-intro">
        <h2 id="enrich-title">
          Let Piper <em>understand your interests.</em>
        </h2>
        <p>
          Optional, and a lot quicker than writing everything out. Paste your
          own bio, captions you wrote (for example on Instagram), favorite
          music, hobbies and activities. Piper proposes interests, activities,
          conversation starters and a summary, and you approve each one. Piper
          never connects to social accounts or scrapes anything, and never
          infers sensitive traits.
        </p>
        <div className="info-legend" aria-label="How information is labeled">
          <span className="confirmed">Confirmed by you · on your profile</span>
          <span className="suggested">AI suggestion · needs your approval</span>
          <span className="unknown">
            Unknown · never guessed (e.g. religion, income, health)
          </span>
          <span className="private">
            Private · what you paste stays on this device
          </span>
        </div>
      </div>
      <div className="enrich-grid">
        <div className="enrich-form">
          <p className="fine-print">
            <ShieldCheck size={13} /> Confirmed interests:{" "}
            {profile.interests.length
              ? profile.interests.join(", ")
              : "none yet"}
            .{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setInput(fictionalSample());
                setInfo("");
              }}
            >
              Use Jamie’s fictional sample
            </button>
          </p>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label} <small>{f.hint}</small>
              <textarea
                rows={f.key === "bio" || f.key === "captions" ? 3 : 2}
                maxLength={f.key === "bio" || f.key === "captions" ? 1200 : 600}
                value={input[f.key]}
                onChange={(e) =>
                  setInput({ ...input, [f.key]: e.target.value })
                }
              />
            </label>
          ))}
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I wrote this myself, it’s fictional for this demo, and I consent to
            sending it to Gemini.
          </label>
          <div className="inline-actions">
            <Button
              disabled={!valid || !consent || busy}
              onClick={() => void askGemini()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              Ask Piper for suggestions
            </Button>
            <Button
              variant="outline"
              disabled={!valid || busy}
              onClick={() =>
                store(
                  keywordSuggestions(input, existing),
                  "Keyword suggestions (not AI) are ready for your review. Nothing has been added yet.",
                )
              }
            >
              Suggest from keywords (no AI)
            </Button>
          </div>
          <PhotoSuggestions
            existing={{ interests: profile.interests }}
            onSuggestions={(suggestions, message) =>
              store(suggestions, message)
            }
          />
          <div className="inline-actions">
            <Button
              size="sm"
              variant="ghost"
              disabled={
                !Object.values(input).some((v) => v.trim()) &&
                !state.enrichment.some((s) => s.status !== "approved")
              }
              onClick={() => {
                setInput(emptyInput());
                dispatchDemo({ type: "enrichment-clear" });
                setError("");
                setInfo(
                  "Deleted the text you pasted and every unapproved suggestion. Approved items stay on your profile, where you can edit them.",
                );
              }}
            >
              <Trash2 size={14} /> Delete my pasted content & suggestions
            </Button>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="saved-text">
              <BadgeCheck size={14} /> {info}
            </p>
          )}
        </div>
        <div className="suggestions">
          <h3>
            Waiting for your review <span>{pending.length}</span>
          </h3>
          {!pending.length && (
            <p className="muted">
              Suggestions appear here. They’re proposals, not facts, until you
              approve them.
            </p>
          )}
          <ul>
            {pending.map((s) => (
              <li key={s.id} className="suggestion">
                <span className="suggestion-kind">
                  {kindLabel[s.kind]}
                  <em>
                    {s.source === "gemini"
                      ? "GEMINI SUGGESTION"
                      : s.source === "photo"
                        ? "FROM YOUR PHOTO · PLEASE CONFIRM"
                        : "KEYWORD MATCH · NOT AI"}
                  </em>
                </span>
                <strong>
                  {s.kind === "activity"
                    ? dateCategoryLabels[s.value as DateCategory]
                    : s.value}
                </strong>
                {s.reason && <p>{s.reason}</p>}
                {s.quote && (
                  <small className="quote">
                    <Quote size={11} /> From your words: “{s.quote}”
                  </small>
                )}
                <div className="inline-actions">
                  <Button size="sm" onClick={() => decide(s.id, true)}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decide(s.id, false)}
                  >
                    Not me
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {!!reviewed.length && (
            <details>
              <summary>Reviewed ({reviewed.length})</summary>
              <ul className="reviewed">
                {reviewed.map((s) => (
                  <li key={s.id}>
                    {s.status === "approved" ? (
                      <Check size={12} />
                    ) : (
                      <X size={12} />
                    )}{" "}
                    {kindLabel[s.kind]}:{" "}
                    {s.kind === "summary"
                      ? "profile summary"
                      : s.kind === "activity"
                        ? dateCategoryLabels[s.value as DateCategory]
                        : s.value}{" "}
                    · {s.status}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="fine-print">
            <ShieldCheck size={13} /> Pending suggestions are never shared with
            other matchmakers. Approved items appear on your profile, where you
            can edit them.{" "}
            <Link href="/profile" className="text-link">
              My Profile <ArrowUpRight size={12} />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
