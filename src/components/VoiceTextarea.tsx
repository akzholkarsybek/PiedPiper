"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * A textarea with an optional microphone button (browser speech-to-text).
 * Uses the Web Speech API (Chrome, Edge, Safari). The mic is hidden where it isn't supported.
 * What you say is appended to what you've typed; you can still edit it afterwards.
 */

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGS = [
  { code: "en-US", label: "EN" },
  { code: "ru-RU", label: "RU" },
  { code: "kk-KZ", label: "KZ" },
] as const;
const LANG_KEY = "wingmate.voiceLang";

const noop = () => () => {};

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (v: string) => void;
};

export function VoiceTextarea({ value, onValueChange, className = "", maxLength, ...rest }: Props) {
  const supported = useSyncExternalStore(noop, () => Boolean(getRecognition()), () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("en-US");
  const rec = useRef<Recognition | null>(null);
  // Latest value, so speech results append to what's there now (not what was there when recording started).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read a saved preference once on mount
    if (saved && LANGS.some((l) => l.code === saved)) setLang(saved);
    return () => rec.current?.stop();
  }, []);

  function append(text: string) {
    const t = text.trim();
    if (!t) return;
    const cur = latest.current;
    const sep = cur && !/\s$/.test(cur) ? " " : "";
    const next = (cur + sep + t).slice(0, maxLength ?? Infinity);
    latest.current = next;
    onValueChange(next);
  }

  function start() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) append(res[0].transcript);
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Microphone is blocked. Allow it in the browser's address bar, then try again.");
      else if (e.error === "no-speech") setError("Didn't hear anything. Try again a bit closer to the mic.");
      else if (e.error !== "aborted") setError("Voice input stopped. You can try again or type instead.");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone.");
    }
  }

  function stop() {
    rec.current?.stop();
  }

  function pickLang(code: string) {
    setLang(code);
    localStorage.setItem(LANG_KEY, code);
    if (listening) stop(); // restart in the new language on the next click
  }

  return (
    <div>
      <div className="relative">
        <textarea
          {...rest}
          className={`${className} ${supported ? "pb-12" : ""}`}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {supported && (
          <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-end gap-2 pointer-events-none">
            {listening && (
              <span className="mr-auto min-w-0 truncate text-xs text-muted italic pointer-events-auto" aria-live="polite">
                {interim || "Listening… speak naturally"}
              </span>
            )}
            <div className="flex rounded-full border border-line bg-paper p-0.5 pointer-events-auto" role="group" aria-label="Voice language">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => pickLang(l.code)}
                  aria-pressed={lang === l.code}
                  className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 transition-colors ${
                    lang === l.code ? "bg-plum text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={listening ? stop : start}
              aria-pressed={listening}
              aria-label={listening ? "Stop voice input" : "Speak instead of typing"}
              title={listening ? "Stop" : "Speak instead of typing"}
              className={`pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                listening ? "bg-coral text-white heartbeat" : "bg-rose-soft text-rose hover:bg-rose hover:text-white"
              }`}
            >
              {listening ? (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <rect width="12" height="12" rx="2.5" fill="currentColor" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      {error && <span className="block text-xs text-coral mt-1.5">{error}</span>}
    </div>
  );
}
