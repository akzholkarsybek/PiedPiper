"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, getMyId, streamEvents } from "@/lib/client";
import type { DateEvent, DateView, PublicProfile, Speaker, Turn, Verdict } from "@/lib/types";
import { Avatar, DemoBadge, HeartRain, Portrait, Skeleton, Typing, VerdictCard } from "@/components/ui";
import { ArrowLeft, ArrowRight, Heart, Refresh, Send, Whisper } from "@/components/icons";

const MIN_GAP_MS = 900; // pace messages so humans can read along
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "loading" | "live" | "deliberating" | "done" | "error";

function DateInner() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<DateView | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typing, setTyping] = useState<Speaker | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [verdicts, setVerdicts] = useState<{ a: Verdict | null; b: Verdict | null }>({ a: null, b: null });
  const [error, setError] = useState<string | null>(null);
  const [whisper, setWhisper] = useState("");
  const [whispers, setWhispers] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const started = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, typing, phase]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const viewerId = getMyId();

    (async () => {
      try {
        const { date } = await api<{ date: DateView }>(`/api/dates/${id}`);
        setView(date);
        if (date.status === "done") {
          setTurns(date.transcript);
          setVerdicts({ a: date.verdictA, b: date.verdictB });
          setPhase("done");
          return;
        }
        if (!date.viewerSide) {
          setTurns(date.transcript);
          setPhase("error");
          setError("Only the two people on this date can watch it live.");
          return;
        }
        setPhase("live");
        if (date.status === "running") {
          // The other person started it: follow along by polling.
          for (;;) {
            await sleep(2000);
            const { date: d } = await api<{ date: DateView }>(`/api/dates/${id}`);
            setTurns(d.transcript);
            if (d.status === "done") {
              setView(d);
              setVerdicts({ a: d.verdictA, b: d.verdictB });
              setPhase("done");
              if (d.matchId) setCelebrate(true);
              return;
            }
            if (d.status === "error") throw new Error("The date was interrupted. Try again.");
          }
        }
        let last = 0;
        await streamEvents<DateEvent>(`/api/dates/${id}/run`, { viewerId }, async (ev) => {
          if (ev.type === "typing") setTyping(ev.speaker);
          else if (ev.type === "turn") {
            const wait = last + MIN_GAP_MS - Date.now();
            if (wait > 0) await sleep(wait);
            last = Date.now();
            setTyping(null);
            setTurns((t) => [...t, ev.turn]);
          } else if (ev.type === "deliberating") {
            setTyping(null);
            setPhase("deliberating");
          } else if (ev.type === "verdict") {
            setVerdicts((v) => ({ ...v, [ev.side]: ev.verdict }));
          } else if (ev.type === "done") {
            setView(ev.date);
            setTurns(ev.date.transcript);
            setVerdicts({ a: ev.date.verdictA, b: ev.date.verdictB });
            setPhase("done");
            if (ev.date.matchId) setCelebrate(true);
          } else if (ev.type === "error") {
            setError(ev.message);
            setPhase("error");
          }
        });
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
      }
    })();
  }, [id]);

  async function sendWhisper(e: React.FormEvent) {
    e.preventDefault();
    const text = whisper.trim();
    if (!text) return;
    setWhisper("");
    setWhispers((w) => [...w, text]);
    try {
      await api(`/api/dates/${id}/nudge`, { method: "POST", body: JSON.stringify({ profileId: getMyId(), text }) });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function redoDate() {
    try {
      await api(`/api/dates/${id}/redo`, { method: "POST" });
      location.reload(); // page reloads, sees a fresh "pending" date and runs it live
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!view) {
    return error ? (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">{error}</div>
    ) : (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <Skeleton className="h-20 w-full rounded-[24px]" />
        <Skeleton className="h-[60vh] w-full rounded-[24px] mt-4" />
      </div>
    );
  }

  const mySide = view.viewerSide ?? "a";
  const me = mySide === "a" ? view.a : view.b;
  const other = mySide === "a" ? view.b : view.a;
  const myVerdict = verdicts[mySide];
  const theirVerdict = verdicts[mySide === "a" ? "b" : "a"];
  const nameOf = (s: Speaker) => (s === "a" ? view.a.name : view.b.name);
  const live = phase === "live" && Boolean(view.viewerSide);

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-5 sm:py-8">
      {/* -------- chat window -------- */}
      <div className="card overflow-hidden shadow-md flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[min(760px,calc(100dvh-9rem))]">
        {/* header */}
        <div className="flex items-center gap-3 px-3 sm:px-5 py-3 border-b border-line bg-paper/95">
          <Link href="/me" className="btn btn-ghost btn-icon shrink-0 border-transparent" aria-label="Back to my agent">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center -space-x-2 shrink-0">
            <Avatar name={other.name} size={40} ring />
            <Avatar name={me.name} size={40} ring />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate flex items-center gap-2">
              {other.name} <span className="text-muted font-normal">&amp;</span> {me.name}
              {other.isSeed && <DemoBadge className="hidden sm:inline" />}
            </div>
            <div className="text-xs text-muted truncate">
              {other.occupation} · {other.city}
            </div>
          </div>
          <StatusPill phase={phase} />
        </div>

        {/* messages */}
        <div ref={scroller} className="flex-1 overflow-y-auto px-3 sm:px-5 py-5 space-y-3 bg-gradient-to-b from-cream/60 to-paper">
          <div className="text-center">
            <span className="inline-block text-[11px] font-medium text-muted bg-paper border border-line rounded-full px-3 py-1">
              ☕ The agents meet at a cozy café
            </span>
          </div>

          {turns.map((t, i) => {
            const mine = t.speaker === mySide;
            const prev = turns[i - 1];
            const firstOfRun = !prev || prev.speaker !== t.speaker;
            return (
              <div key={i} className={`flex items-end gap-2 bubble-in ${mine ? "flex-row-reverse" : ""}`}>
                <div className="w-8 shrink-0">{firstOfRun && <Avatar name={nameOf(t.speaker)} size={32} />}</div>
                <div className={`flex flex-col max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
                  {firstOfRun && (
                    <span className="text-[11px] text-muted mb-1 px-1">
                      {nameOf(t.speaker)}&apos;s agent
                      {t.nudged && mine && <span className="text-rose font-medium"> · used your whisper 🤫</span>}
                    </span>
                  )}
                  <div
                    className={`rounded-[20px] px-4 py-2.5 leading-relaxed ${
                      mine
                        ? "bg-plum text-white rounded-br-md shadow-sm"
                        : "bg-paper border border-line rounded-bl-md shadow-sm"
                    }`}
                  >
                    {t.text}
                  </div>
                  {!firstOfRun && t.nudged && mine && <span className="text-[11px] text-rose mt-1 px-1">used your whisper 🤫</span>}
                </div>
              </div>
            );
          })}

          {typing && (
            <div className={`flex items-end gap-2 fade-in ${typing === mySide ? "flex-row-reverse" : ""}`}>
              <Avatar name={nameOf(typing)} size={32} />
              <div
                className={`rounded-[20px] px-4 py-3.5 ${
                  typing === mySide ? "bg-plum rounded-br-md" : "bg-paper border border-line rounded-bl-md"
                }`}
              >
                <Typing light={typing === mySide} />
              </div>
            </div>
          )}

          {phase === "deliberating" && (
            <div className="flex flex-col items-center text-center py-8 fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-grad blur-xl opacity-40 rounded-full heartbeat" />
                <div className="relative w-16 h-16 rounded-full bg-grad text-white flex items-center justify-center heartbeat">
                  <Heart size={26} filled />
                </div>
              </div>
              <div className="display text-2xl mt-4">The agents are deciding…</div>
              <p className="text-sm text-muted mt-1">Each one is writing a private report to its human.</p>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center pt-2">
              <button
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose bg-rose-soft rounded-full px-3 py-1.5"
                onClick={() => results.current?.scrollIntoView({ behavior: "smooth" })}
              >
                Date over · see the verdict ↓
              </button>
            </div>
          )}
        </div>

        {/* composer */}
        {live && (
          <form onSubmit={sendWhisper} className="border-t border-line px-3 sm:px-4 py-3 bg-paper">
            {whispers.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
                {whispers.map((w, i) => (
                  <span key={i} className="shrink-0 text-xs rounded-full bg-rose-soft text-rose px-2.5 py-1">
                    🤫 {w}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Whisper size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose" />
                <input
                  className="input rounded-full pl-10"
                  value={whisper}
                  onChange={(e) => setWhisper(e.target.value)}
                  placeholder="Whisper to your agent… “ask about their dream trip”"
                  maxLength={200}
                  aria-label="Whisper to your agent"
                />
              </div>
              <button className="btn btn-grad btn-icon shrink-0" disabled={!whisper.trim()} aria-label="Send whisper">
                <Send size={17} />
              </button>
            </div>
            <p className="text-[11px] text-muted mt-1.5 px-2">Coach mode: your agent works it in naturally. They never see it.</p>
          </form>
        )}
      </div>

      {error && (
        <div className="card p-5 mt-5 text-center">
          <p className="text-coral">{error}</p>
          {phase === "error" && view.viewerSide && (
            <button className="btn btn-ghost mt-3" onClick={() => location.reload()}>
              <Refresh size={16} /> Try again
            </button>
          )}
        </div>
      )}

      {/* -------- results -------- */}
      {phase === "done" && (
        <div ref={results} className="mt-6 space-y-4 scroll-mt-24">
          {view.matchId ? (
            <div className="relative overflow-hidden rounded-[24px] bg-grad text-white p-7 text-center shadow-md rise">
              <HeartRain count={10} />
              <div className="relative">
                <div className="flex justify-center -space-x-3">
                  <Avatar name={other.name} size={56} ring />
                  <Avatar name={me.name} size={56} ring />
                </div>
                <div className="display text-5xl mt-4">It&apos;s a match</div>
                <p className="text-white/85 mt-2 max-w-md mx-auto">
                  Both agents want you two to meet.{" "}
                  {other.isSeed ? `${other.name} is a demo profile, so invite a real person to try the human chat.` : "Your chat is open."}
                </p>
                <Link href={`/match/${view.matchId}`} className="btn bg-white text-plum hover:bg-cream mt-5 px-7">
                  Meet {other.name} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="card p-7 text-center rise">
              <div className="w-14 h-14 rounded-full bg-cream border border-line flex items-center justify-center mx-auto text-2xl">🌙</div>
              <div className="display text-4xl mt-4">Not a mutual match</div>
              <p className="text-muted mt-2 text-sm max-w-sm mx-auto">That&apos;s the point: you just saved an evening. Your agent will keep looking.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <Link href="/me" className="btn btn-primary">
                  Back to the lineup
                </Link>
                {view.viewerSide && (
                  <button className="btn btn-ghost" onClick={redoDate}>
                    <Refresh size={16} /> Give it another try
                  </button>
                )}
              </div>
            </div>
          )}
          {myVerdict && <VerdictCard v={myVerdict} title={`Your agent's private report on ${other.name}`} />}
          {theirVerdict && <VerdictCard v={theirVerdict} title={`${other.name}'s agent on you (demo profile, shown for transparency)`} />}
        </div>
      )}

      {celebrate && view.matchId && (
        <MatchCelebration
          me={me}
          other={other}
          matchId={view.matchId}
          onClose={() => {
            setCelebrate(false);
            setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  if (phase === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-grad text-white text-[11px] font-semibold px-3 py-1.5 shrink-0">
        <span className="live-dot" /> LIVE
      </span>
    );
  const map: Record<Exclude<Phase, "live">, [string, string]> = {
    loading: ["…", "bg-line text-muted"],
    deliberating: ["Deciding…", "bg-plum-soft text-plum"],
    done: ["Finished", "bg-green-soft text-green"],
    error: ["Interrupted", "bg-coral-soft text-coral"],
  };
  const [text, cls] = map[phase];
  return <span className={`rounded-full text-[11px] font-semibold px-3 py-1.5 shrink-0 ${cls}`}>{text}</span>;
}

function MatchCelebration({
  me,
  other,
  matchId,
  onClose,
}: {
  me: PublicProfile;
  other: PublicProfile;
  matchId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
      style={{ background: "radial-gradient(circle at 50% 40%, rgba(214,58,106,0.94), rgba(59,35,64,0.97))" }}
      role="dialog"
      aria-modal="true"
      aria-label="It's a match"
    >
      <HeartRain count={22} />
      <div className="relative text-center text-white max-w-md w-full">
        <div className="flex justify-center items-center h-56">
          <div className="slide-l">
            <Portrait name={other.name} className="w-36 h-48 sm:w-40 sm:h-52 rounded-[24px] shadow-lg border-4 border-white/90">
              <div className="absolute bottom-3 inset-x-0 display text-2xl">{other.name}</div>
            </Portrait>
          </div>
          <div className="pop z-10 -mx-5 w-16 h-16 rounded-full bg-white text-rose flex items-center justify-center shadow-lg" style={{ animationDelay: "0.6s" }}>
            <Heart size={30} filled className="heartbeat" />
          </div>
          <div className="slide-r">
            <Portrait name={me.name} className="w-36 h-48 sm:w-40 sm:h-52 rounded-[24px] shadow-lg border-4 border-white/90">
              <div className="absolute bottom-3 inset-x-0 display text-2xl">{me.name}</div>
            </Portrait>
          </div>
        </div>
        <h2 className="display italic text-6xl sm:text-7xl mt-6 pop" style={{ animationDelay: "0.8s" }}>
          It&apos;s a match!
        </h2>
        <p className="text-white/85 mt-3 rise" style={{ animationDelay: "1s" }}>
          Both agents said yes. You and {other.name} should meet.
        </p>
        <div className="mt-8 flex flex-col gap-3 rise" style={{ animationDelay: "1.15s" }}>
          <Link href={`/match/${matchId}`} className="btn bg-white text-plum hover:bg-cream py-3.5 text-base">
            Say hi to {other.name} <ArrowRight size={17} />
          </Link>
          <button className="btn text-white/90 hover:text-white hover:bg-white/10" onClick={onClose}>
            Read the agents&apos; reports first
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DatePage() {
  return (
    <Suspense>
      <DateInner />
    </Suspense>
  );
}
