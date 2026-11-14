"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, getMyId } from "@/lib/client";
import type { ChatMessage, DateView } from "@/lib/types";
import { Avatar, DemoBadge, Portrait, ScoreRing, Skeleton, VerdictCard } from "@/components/ui";
import { ArrowLeft, Briefcase, ChevronDown, Heart, LinkIcon, MapPin, Send, Sparkle } from "@/components/icons";

function MatchInner() {
  const { id } = useParams<{ id: string }>();
  const [date, setDate] = useState<DateView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [openers, setOpeners] = useState<string[]>([]);
  const [wingBusy, setWingBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "why" | "transcript">("none");
  const [error, setError] = useState<string | null>(null);
  const [myId] = useState<string | null>(() => (typeof window === "undefined" ? null : getMyId()));
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    const r = await api<{ messages: ChatMessage[] }>(`/api/matches/${id}/messages`);
    setMessages(r.messages);
  }, [id]);

  useEffect(() => {
    api<{ date: DateView }>(`/api/matches/${id}`)
      .then((r) => setDate(r.date))
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state is set after await
    loadMessages().catch(() => {});
    const t = setInterval(() => loadMessages().catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [id, loadMessages]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, openers.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setError(null);
    try {
      await api(`/api/matches/${id}/messages`, { method: "POST", body: JSON.stringify({ text: t }) });
      setText("");
      setOpeners([]);
      loadMessages();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function askWingman() {
    setWingBusy(true);
    setError(null);
    try {
      const r = await api<{ openers: string[] }>(`/api/matches/${id}/wingman`, { method: "POST" });
      setOpeners(r.openers);
    } catch (err) {
      setError((err as Error).message);
    }
    setWingBusy(false);
  }

  function pickOpener(o: string) {
    setText(o);
    input.current?.focus();
  }

  if (!date) {
    return error ? (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">{error}</div>
    ) : (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-40 w-full rounded-[24px]" />
        <Skeleton className="h-96 w-full rounded-[24px]" />
      </div>
    );
  }

  const mySide = date.viewerSide ?? "a";
  const me = mySide === "a" ? date.a : date.b;
  const other = mySide === "a" ? date.b : date.a;
  const myVerdict = mySide === "a" ? date.verdictA : date.verdictB;
  const toggle = (p: "why" | "transcript") => setPanel((cur) => (cur === p ? "none" : p));

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-5 sm:py-8 space-y-4">
      <Link href="/me" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink px-1">
        <ArrowLeft size={16} /> My agent
      </Link>

      {/* -------- match header -------- */}
      <div className="card overflow-hidden rise">
        <Portrait name={other.name} className="h-44 sm:h-52">
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-white/90 text-rose px-2.5 py-1">
            <Heart size={11} filled /> Mutual match
          </span>
          {myVerdict && (
            <div className="absolute top-3 right-3 rounded-full bg-black/15 backdrop-blur-md p-1">
              <ScoreRing value={myVerdict.overall} size={54} stroke={5} light label="fit" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="display text-5xl leading-none">
                {other.name}
                <span className="opacity-80">, {other.age}</span>
              </div>
              <div className="text-sm text-white/90 mt-2 flex flex-wrap gap-x-3">
                <span className="inline-flex items-center gap-1">
                  <Briefcase size={13} /> {other.occupation}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {other.city}
                </span>
              </div>
            </div>
            {other.isSeed && <DemoBadge className="bg-white/90 shrink-0" />}
          </div>
        </Portrait>
        <div className="px-5 py-4">
          <p className="leading-relaxed">{other.bio}</p>
          {myVerdict?.headline && (
            <p className="text-sm text-muted mt-2">
              Your agent&apos;s take: <span className="text-ink font-medium">“{myVerdict.headline}”</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {myVerdict && (
              <button className="chip text-sm py-1.5" aria-pressed={panel === "why"} onClick={() => toggle("why")}>
                <Sparkle size={14} /> Why you matched
                <ChevronDown size={14} className={`transition-transform ${panel === "why" ? "rotate-180" : ""}`} />
              </button>
            )}
            <button className="chip text-sm py-1.5" aria-pressed={panel === "transcript"} onClick={() => toggle("transcript")}>
              Read the agent date
              <ChevronDown size={14} className={`transition-transform ${panel === "transcript" ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {panel === "why" && myVerdict && <VerdictCard v={myVerdict} title={`Why your agent liked ${other.name}`} />}
      {panel === "transcript" && (
        <div className="card p-5 space-y-3 rise">
          {date.transcript.map((t, i) => {
            const name = t.speaker === "a" ? date.a.name : date.b.name;
            return (
              <div key={i} className="flex gap-2.5 text-sm">
                <Avatar name={name} size={26} />
                <p className="leading-relaxed">
                  <span className="font-semibold">{name}&apos;s agent </span>
                  <span className="text-muted">·</span> {t.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* -------- chat -------- */}
      <div className="card overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
          <div>
            <h2 className="display text-3xl leading-none">Now it&apos;s just you two</h2>
            <p className="hint mt-1">The agents step back. Real messages, from real people.</p>
          </div>
          <div className="hidden sm:flex -space-x-2">
            <Avatar name={other.name} size={34} ring />
            <Avatar name={me.name} size={34} ring />
          </div>
        </div>

        {other.isSeed ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-plum-soft text-plum flex items-center justify-center mx-auto">
              <LinkIcon size={22} />
            </div>
            <div className="display text-2xl mt-4">{other.name} is a demo profile</div>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              There&apos;s no real person to talk to here. Copy your invite link and send it to a friend to try the real human
              handoff.
            </p>
            <Link href="/me" className="btn btn-grad mt-5">
              Get my invite link
            </Link>
          </div>
        ) : (
          <>
            <div ref={scroller} className="h-[46vh] min-h-72 overflow-y-auto px-4 sm:px-5 py-5 space-y-2 bg-gradient-to-b from-cream/50 to-paper">
              {messages.length === 0 && openers.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="flex -space-x-3">
                    <Avatar name={other.name} size={52} ring />
                    <Avatar name={me.name} size={52} ring />
                  </div>
                  <div className="display text-2xl mt-4">Someone has to go first 😉</div>
                  <p className="text-sm text-muted mt-1">Stuck? Wingman can suggest an opener based on your agent date.</p>
                  <button className="btn btn-ghost mt-4 text-sm" onClick={askWingman} disabled={wingBusy}>
                    <Sparkle size={15} className="text-rose" /> {wingBusy ? "Thinking…" : "Help me start"}
                  </button>
                </div>
              )}
              {messages.map((m, i) => {
                const mine = m.from === myId;
                const prev = messages[i - 1];
                const gap = prev && prev.from !== m.from;
                return (
                  <div key={m.id} className={`flex bubble-in ${mine ? "justify-end" : "justify-start"} ${gap ? "pt-2" : ""}`}>
                    <div
                      className={`max-w-[78%] rounded-[20px] px-4 py-2.5 leading-relaxed ${
                        mine ? "bg-grad text-white rounded-br-md shadow-sm" : "bg-paper border border-line rounded-bl-md"
                      }`}
                    >
                      {m.text}
                      <div className={`text-[10px] mt-0.5 text-right ${mine ? "text-white/70" : "text-muted"}`}>
                        {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {openers.length > 0 && (
              <div className="px-4 sm:px-5 pt-3 border-t border-line bg-paper">
                <div className="text-xs font-semibold text-muted flex items-center gap-1.5">
                  <Sparkle size={13} className="text-rose" /> Wingman ideas. Tap one, make it yours, then send.
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2.5">
                  {openers.map((o, i) => (
                    <button
                      key={i}
                      className="shrink-0 w-64 text-left text-sm rounded-2xl border border-line bg-cream px-3.5 py-2.5 hover:border-rose hover:bg-rose-soft/40 transition-colors"
                      onClick={() => pickOpener(o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={send} className="flex items-center gap-2 px-3 sm:px-4 py-3 border-t border-line bg-paper">
              <button
                type="button"
                className="btn btn-ghost btn-icon shrink-0 text-rose"
                onClick={askWingman}
                disabled={wingBusy}
                aria-label="Ask Wingman for ideas"
                title="Wingman: suggest an opener"
              >
                <Sparkle size={17} className={wingBusy ? "heartbeat" : ""} />
              </button>
              <input
                ref={input}
                className="input rounded-full"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${other.name}…`}
                maxLength={1000}
              />
              <button className="btn btn-grad btn-icon shrink-0" disabled={!text.trim()} aria-label="Send message">
                <Send size={17} />
              </button>
            </form>
          </>
        )}
        {error && <p className="text-sm text-coral px-5 pb-4">{error}</p>}
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense>
      <MatchInner />
    </Suspense>
  );
}
