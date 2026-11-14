"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Heart,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { ProfileEditor } from "./profile-editor";
import { Modal } from "./modal";
import {
  blankProfile,
  type Profile,
  dimensionLabels,
  dimensionOptions,
  title,
  type Dimension,
} from "@/lib/profile";
import { type Recommendation } from "@/lib/matching";
import { browserSupabase, supabaseConfigured } from "@/lib/supabase/browser";
type AccountData = {
  user: { id: string; email: string };
  profile: Profile | null;
  candidates: Recommendation[];
  decisions: { target_id: string; decision: string }[];
  matches: { id: string; user_a: string; user_b: string }[];
  messages: {
    id: string;
    match_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }[];
  questions: {
    id: string;
    requester_id: string;
    subject_id: string;
    dimension: Dimension;
    status: string;
  }[];
};
export function Account() {
  const [data, setData] = useState<AccountData | null>(null),
    [loading, setLoading] = useState(supabaseConfigured),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [signup, setSignup] = useState(false),
    [tab, setTab] = useState<"discover" | "profile" | "messages" | "questions">(
      "discover",
    ),
    [activeMatch, setActiveMatch] = useState(""),
    [text, setText] = useState(""),
    [deleting, setDeleting] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" });
    const result = await res.json();
    if (res.status === 401) {
      setData(null);
      return;
    }
    if (!res.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    fetch("/api/account", { cache: "no-store" })
      .then(async (res) => {
        const result = await res.json();
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(result.error);
        return result as AccountData;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!data || tab !== "messages") return;
    const timer = setInterval(() => {
      void load().catch(() =>
        setError("Messages could not refresh. Please refresh the page."),
      );
    }, 8000);
    return () => clearInterval(timer);
  }, [data, tab, load]);
  async function action(body: unknown) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const f = new FormData(e.currentTarget),
        email = String(f.get("email")),
        password = String(f.get("password"));
      const db = browserSupabase();
      const result = signup
        ? await db.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session)
        setNotice("Check your email to confirm your account, then sign in.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function signout() {
    setBusy(true);
    const result = await browserSupabase().auth.signOut();
    if (result.error) setError("Sign-out failed. Please try again.");
    else setData(null);
    setBusy(false);
  }
  const header = (
    <header className="flow-nav">
      <Brand />
      <Link className="text-link" href="/discover">
        Fictional guest demo <ArrowRight size={14} />
      </Link>
    </header>
  );
  if (!supabaseConfigured)
    return (
      <>
        {header}
        <main id="main" className="account-panel">
          <span className="badge sage">
            <ShieldCheck size={13} />
            REAL ACCOUNTS
          </span>
          <h1>
            A thoughtful space,
            <br />
            <em>coming together.</em>
          </h1>
          <p>
            Real accounts are not enabled on this installation yet. The complete
            interactive guest experience is available now, with fictional people
            and no sign-up.
          </p>
          <div className="notice">
            <p>
              Real profiles and messages use a separate, authenticated Supabase
              database. This guest demo does not create a real dating profile.
            </p>
          </div>
          <Button asChild>
            <Link href="/onboarding?demo=1">
              Try the interactive demo <ArrowRight size={17} />
            </Link>
          </Button>
        </main>
      </>
    );
  if (loading)
    return (
      <>
        {header}
        <main id="main" className="loading-screen">
          Opening your account…
        </main>
      </>
    );
  if (!data)
    return (
      <>
        {header}
        <main id="main" className="account-panel">
          <span className="eyebrow">A REAL CONNECTION STARTS HERE</span>
          <h1>
            {signup ? "Make a little" : "Welcome"}
            <br />
            <em>{signup ? "room for possibility." : "back."}</em>
          </h1>
          <p>
            {signup
              ? "Create your adult account and review your profile before sharing."
              : "Sign in to your private account."}
          </p>
          <form onSubmit={(e) => void auth(e)}>
            <label>
              Email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            {signup && (
              <label className="check-label">
                <input type="checkbox" required />I am at least 18 and
                understand the{" "}
                <Link href="/privacy">privacy & safety information</Link>.
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={16} />
            </Button>
          </form>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {notice && (
            <div className="notice success-notice" role="status">
              {notice}
            </div>
          )}
          <Button variant="ghost" onClick={() => setSignup(!signup)}>
            {signup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </Button>
        </main>
      </>
    );
  const selectedMatch =
    data.matches.find((m) => m.id === activeMatch) ?? data.matches[0];
  return (
    <>
      {header}
      <main id="main" className="reading-page" style={{ maxWidth: 1080 }}>
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              YOUR REAL ACCOUNT · SEPARATE FROM THE DEMO
            </span>
            <h1>
              Hello, <em>{data.profile?.name || "possibility"}.</em>
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void signout()}
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
        <nav className="real-nav" aria-label="Account navigation">
          {(["discover", "profile", "messages", "questions"] as const).map(
            (t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "default" : "outline"}
                onClick={() => setTab(t)}
              >
                {title(t)}
              </Button>
            ),
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            Refresh
          </Button>
        </nav>
        {error && (
          <div role="alert" className="notice error-notice">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice success-notice">
            {notice}
          </div>
        )}
        {!data.profile || tab === "profile" ? (
          <>
            <p>
              Real profiles are entered manually on this installation. Review
              all details and approve sharing before you receive introductions.
              Guest data is never imported into this account.
            </p>
            <ProfileEditor
              key={data.profile?.id ?? "new"}
              profile={
                data.profile ?? {
                  ...blankProfile(data.user.id),
                  fictional: false,
                }
              }
              saveLabel="Approve & save real profile"
              onSave={async (p) => {
                if (!(await action({ type: "profile", profile: p })))
                  throw new Error(
                    "The profile could not be saved. Check the account error above.",
                  );
                setNotice("Your approved profile is saved.");
                setTab("discover");
              }}
            />
            {data.profile && (
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 size={15} />
                Delete my application data
              </Button>
            )}
          </>
        ) : tab === "discover" ? (
          <>
            <p>
              Only real, approved profiles appear here. No fictional profiles
              are added to this database.
            </p>
            <div className="real-grid">
              {data.candidates
                .filter(
                  (r) =>
                    !data.decisions.some(
                      (d) =>
                        d.target_id === r.profile.id && d.decision === "pass",
                    ),
                )
                .slice(0, 6)
                .map((r) => (
                  <article key={r.profile.id} className="real-card">
                    <h2>
                      {r.profile.name}, {r.profile.age}
                    </h2>
                    <span className="badge sage">
                      {r.profile.city} · {title(r.profile.intent)}
                    </span>
                    <p>{r.profile.bio}</p>
                    <h3>Why this introduction</h3>
                    {r.evidence.map((e) => (
                      <p key={e}>
                        <Check size={12} /> {e}
                      </p>
                    ))}
                    {r.differences.map((d) => (
                      <p key={d}>{d}</p>
                    ))}
                    {r.missing.map((q) => (
                      <p key={q.key}>
                        {q.reason}
                        {q.subjectId === r.profile.id &&
                          !data.questions.some(
                            (x) =>
                              x.requester_id === data.user.id &&
                              x.subject_id === q.subjectId &&
                              x.dimension === q.dimension,
                          ) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void action({
                                  type: "question",
                                  target: r.profile.id,
                                  dimension: q.dimension,
                                })
                              }
                            >
                              Invite an optional answer
                            </Button>
                          )}
                      </p>
                    ))}
                    <div className="inline-actions">
                      <Button
                        disabled={
                          busy ||
                          data.decisions.some(
                            (d) =>
                              d.target_id === r.profile.id &&
                              d.decision === "interested",
                          )
                        }
                        onClick={() =>
                          void action({
                            type: "decision",
                            target: r.profile.id,
                            decision: "interested",
                          })
                        }
                      >
                        <Heart size={14} />
                        {data.decisions.some(
                          (d) =>
                            d.target_id === r.profile.id &&
                            d.decision === "interested",
                        )
                          ? "Interest saved"
                          : "Interested"}
                      </Button>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() =>
                          void action({
                            type: "decision",
                            target: r.profile.id,
                            decision: "pass",
                          })
                        }
                      >
                        Pass
                      </Button>
                      <Button
                        disabled={busy}
                        variant="ghost"
                        onClick={() =>
                          void action({ type: "block", target: r.profile.id })
                        }
                      >
                        Block
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
            {!data.candidates.length && (
              <div className="empty-state">
                <Sparkles size={28} />
                <h2>A little room for possibility.</h2>
                <p>
                  No approved members currently meet your mutual requirements.
                  Your profile is saved. You can edit your preferences or return
                  later.
                </p>
              </div>
            )}
          </>
        ) : tab === "messages" ? (
          <>
            <p>
              Human messages only. New messages refresh every eight seconds.
            </p>
            {!selectedMatch ? (
              <div className="empty-state">
                <MessageCircle size={30} />
                <h2>Mutual interest comes first.</h2>
                <p>
                  Your messaging space opens when both people choose an
                  introduction.
                </p>
              </div>
            ) : (
              <>
                <label>
                  Connection
                  <select
                    value={selectedMatch.id}
                    onChange={(e) => setActiveMatch(e.target.value)}
                  >
                    {data.matches.map((m, i) => (
                      <option key={m.id} value={m.id}>
                        Connection {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="real-message-list">
                  {data.messages
                    .filter((m) => m.match_id === selectedMatch.id)
                    .map((m) => (
                      <p
                        key={m.id}
                        className={m.sender_id === data.user.id ? "sent" : ""}
                      >
                        <strong>
                          {m.sender_id === data.user.id
                            ? "You"
                            : "Your connection"}
                          :{" "}
                        </strong>
                        {m.body}
                      </p>
                    ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action({
                        type: "message",
                        matchId: selectedMatch.id,
                        text,
                      })
                    )
                      setText("");
                  }}
                >
                  <label>
                    Message
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <div className="inline-actions">
                    <Button disabled={busy || !text.trim()} type="submit">
                      Send message
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        void action({
                          type: "block",
                          target:
                            selectedMatch.user_a === data.user.id
                              ? selectedMatch.user_b
                              : selectedMatch.user_a,
                          reason: "Safety concern reported from a conversation",
                        })
                      }
                    >
                      Report concern & block
                    </Button>
                  </div>
                </form>
              </>
            )}
          </>
        ) : (
          <>
            <p>
              Answering is optional. Shared answers update your approved
              profile, so eligible members can see them. Declined answers remain
              private.
            </p>
            {data.questions
              .filter(
                (q) => q.subject_id === data.user.id && q.status === "pending",
              )
              .map((q) => (
                <form
                  className="real-card"
                  key={q.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action({
                      type: "answer",
                      questionId: q.id,
                      answer: String(f.get("answer")),
                      consent: true,
                    });
                  }}
                >
                  <h2>{dimensionLabels[q.dimension]}</h2>
                  <p>Would you feel comfortable sharing your preference?</p>
                  <label>
                    Your answer
                    <select name="answer" required>
                      <option value="">Choose an answer</option>
                      {dimensionOptions[q.dimension].map((v) => (
                        <option value={v} key={v}>
                          {title(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label">
                    <input type="checkbox" required />I approve adding this
                    answer to my shared profile.
                  </label>
                  <div className="inline-actions">
                    <Button disabled={busy} type="submit">
                      Approve & share
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        void action({
                          type: "answer",
                          questionId: q.id,
                          answer: "",
                          consent: false,
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </form>
              ))}
            {!data.questions.some(
              (q) => q.subject_id === data.user.id && q.status === "pending",
            ) && (
              <div className="empty-state">
                <ShieldCheck size={30} />
                <h2>All caught up.</h2>
                <p>No optional questions are waiting for you.</p>
              </div>
            )}
          </>
        )}
        {deleting && (
          <Modal
            title="Delete your application data?"
            onClose={() => setDeleting(false)}
          >
            <p>
              Your profile, matches, messages, decisions, and related records
              will be deleted. Your sign-in identity will remain; account
              identity deletion is managed by the operator.
            </p>
            <div className="inline-actions">
              <Button variant="outline" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (await action({ type: "delete" })) {
                    setDeleting(false);
                    setNotice("Your application data has been deleted.");
                  }
                }}
              >
                Delete application data
              </Button>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}
