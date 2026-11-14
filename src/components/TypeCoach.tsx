"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { Check, Send, Sparkle } from "@/components/icons";

type Msg = { role: "coach" | "me"; text: string };
type CoachReply = { reply: string; suggestion: string };

/**
 * Built-in dating coach for "What's your type?". It asks one question at a time, helps the person
 * get past a checklist to what really matters, and drafts their type for them to use or edit.
 * The chat isn't saved: only the type they choose to use goes into their profile.
 */
export function TypeCoach({
  profile,
  draft,
  onUse,
}: {
  /** Their onboarding answers so far (no photo, no "keep private" notes). */
  profile: Record<string, string>;
  draft: string;
  onUse: (text: string) => void;
}) {
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest message in view inside the chat box (never scrolls the page).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history, busy]);

  async function ask(next: Msg[]) {
    setHistory(next);
    setBusy(true);
    setError(null);
    try {
      const r = await api<CoachReply>("/api/onboard/coach", {
        method: "POST",
        body: JSON.stringify({ profile, draft, history: next }),
      });
      setHistory([...next, { role: "coach", text: r.reply }]);
      if (r.suggestion) setSuggestion(r.suggestion);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    ask([...history, { role: "me", text }]);
  }

  if (history.length === 0 && !busy) {
    return (
      <div className="rounded-3xl border border-line bg-gradient-to-r from-plum-soft to-paper p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-grad text-white flex items-center justify-center shrink-0">
          <Sparkle size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Not sure what your type is?</div>
          <p className="text-sm text-muted">Talk it through with your dating coach. A few questions, then it writes your type for you.</p>
          {error && <p className="text-sm text-coral mt-1">{error}</p>}
        </div>
        <button type="button" className="btn btn-grad text-sm py-2.5 shrink-0" onClick={() => ask([])}>
          Talk to my coach
        </button>
      </div>
    );
  }

  const used = suggestion && draft.trim() === suggestion.trim();

  return (
    <div className="rounded-3xl border border-line bg-paper overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center gap-2 bg-plum-soft">
        <Sparkle size={16} className="text-plum" />
        <span className="font-semibold text-plum">Your dating coach</span>
        <span className="text-xs text-muted ml-auto">Private. Only the type you use is saved.</span>
      </div>

      <div ref={scroller} className="max-h-80 overflow-y-auto px-5 py-4 space-y-3" aria-live="polite">
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "me" ? "bg-ink text-white rounded-br-md" : "bg-cream rounded-bl-md"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-md bg-cream px-3.5 py-2.5 text-sm text-muted italic">Coach is thinking…</p>
          </div>
        )}
      </div>

      {suggestion && (
        <div className="mx-5 mb-4 rounded-2xl border border-rose/30 bg-rose-soft p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose">Your type, as your coach hears it</div>
          <p className="text-sm leading-relaxed mt-1.5">{suggestion}</p>
          <button type="button" className={`btn text-sm py-2 mt-3 ${used ? "btn-ghost" : "btn-primary"}`} disabled={!!used} onClick={() => onUse(suggestion)}>
            {used ? (
              <>
                <Check size={15} /> Using this
              </>
            ) : (
              "Use this as my type"
            )}
          </button>
        </div>
      )}

      <div className="border-t border-line p-3 flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <VoiceTextarea
            className="input min-h-14 text-sm"
            value={input}
            onValueChange={setInput}
            placeholder="Answer by typing or with the mic…"
            maxLength={800}
            aria-label="Answer your coach"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
        <button type="button" className="btn btn-grad h-11 w-11 p-0 shrink-0" disabled={!input.trim() || busy} onClick={send} aria-label="Send to coach">
          <Send size={16} />
        </button>
      </div>
      {error && <p className="text-sm text-coral px-5 pb-3">{error}</p>}
    </div>
  );
}
