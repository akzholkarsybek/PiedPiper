"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Heart, Shield } from "./icons";

/**
 * First-visit gate: the visitor must confirm they are 18+ AND agree to how their data is used
 * before they can use the site. Remembered in this browser (localStorage).
 * Bump the version to show it again after the data notice changes.
 */
const KEY = "wingmate.consent.v1";

function readAccepted(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

export function ConsentGate() {
  // Server render: unknown, show nothing. Client: show the gate until accepted.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [adult, setAdult] = useState(false);
  const [data, setData] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Keep the page behind the dialog from scrolling or being tabbed into.
  useEffect(() => {
    if (accepted) return;
    const blocked = [...document.querySelectorAll<HTMLElement>("body > header, main, body > footer")];
    blocked.forEach((el) => el.setAttribute("inert", ""));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      blocked.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = prev;
    };
  }, [accepted]);

  if (accepted) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ adult: true, dataNotice: true, at: new Date().toISOString() }));
    } catch {
      /* storage blocked: the gate will show again next visit */
    }
    listeners.forEach((l) => l());
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 fade-in"
      style={{ background: "radial-gradient(circle at 50% 30%, rgba(59,35,64,0.55), rgba(29,26,22,0.75))" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="card shadow-lg w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden pop">
        <div className="px-6 sm:px-7 pt-6 pb-4 border-b border-line shrink-0">
          <span className="w-11 h-11 rounded-full bg-grad text-white flex items-center justify-center shadow-md">
            <Heart size={20} filled />
          </span>
          <h2 id="consent-title" className="display text-4xl leading-none mt-4">
            Before you start
          </h2>
          <p className="text-sm text-muted mt-2">Wingmate is a dating app for adults. Please confirm both points to continue.</p>
        </div>

        {leaving ? (
          <div className="px-6 sm:px-7 py-8 text-center">
            <div className="text-3xl" aria-hidden>
              👋
            </div>
            <p className="font-semibold mt-3">Sorry, Wingmate is only for people 18 and older.</p>
            <p className="text-sm text-muted mt-1">You can close this tab.</p>
            <button className="btn btn-ghost mt-5 text-sm" onClick={() => setLeaving(false)}>
              Go back
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 sm:px-7 py-5 space-y-3 overflow-y-auto min-h-0">
              <label className="flex gap-3 cursor-pointer rounded-2xl border border-line p-4 hover:bg-cream has-[:checked]:border-rose has-[:checked]:bg-rose-soft/50">
                <input type="checkbox" className="mt-0.5 w-5 h-5 accent-[var(--rose)] shrink-0" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>
                  <span className="font-semibold block">I am 18 years old or older</span>
                  <span className="text-sm text-muted">Wingmate is only for adults.</span>
                </span>
              </label>

              <label className="flex gap-3 cursor-pointer rounded-2xl border border-line p-4 hover:bg-cream has-[:checked]:border-rose has-[:checked]:bg-rose-soft/50">
                <input type="checkbox" className="mt-0.5 w-5 h-5 accent-[var(--rose)] shrink-0" checked={data} onChange={(e) => setData(e.target.checked)} />
                <span>
                  <span className="font-semibold block">I agree to how my data is collected and used</span>
                  <span className="text-sm text-muted">Read the summary below.</span>
                </span>
              </label>

              <div className="rounded-2xl bg-plum-soft/70 p-4 text-sm leading-relaxed">
                <div className="font-semibold flex items-center gap-1.5 text-plum">
                  <Shield size={15} /> What we collect and why
                </div>
                <ul className="mt-2 space-y-1.5 list-disc pl-5 marker:text-plum/60">
                  <li>
                    <b>What you tell us:</b> your name, age, city, preferences, your answers about yourself, money habits,
                    dealbreakers, private notes, and an optional photo.
                  </li>
                  <li>
                    <b>What happens in the app:</b> your agent&apos;s dates, verdicts, coach whispers and chat messages.
                  </li>
                  <li>
                    <b>AI processing:</b> this information is sent to Google&apos;s Gemini AI to build your agent and run its
                    dates. Your private notes guide your agent but are never shown to anyone.
                  </li>
                  <li>
                    <b>Storage:</b> your data is saved on the Wingmate server. There is no login; this browser remembers your
                    profile.
                  </li>
                  <li>
                    <b>Voice input</b> (optional) uses your browser&apos;s speech recognition. In Chrome, audio is processed by
                    Google.
                  </li>
                </ul>
                <p className="mt-2 text-muted">Don&apos;t share anything you&apos;re not comfortable with an AI processing.</p>
              </div>
            </div>

            <div className="px-6 sm:px-7 py-4 border-t border-line bg-paper shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <button className="text-sm text-muted hover:text-ink underline-offset-2 hover:underline" onClick={() => setLeaving(true)}>
                I&apos;m under 18
              </button>
              <div className="flex flex-col items-stretch sm:items-end gap-1">
                <button className="btn btn-grad px-7" disabled={!adult || !data} onClick={accept}>
                  Continue to Wingmate
                </button>
                {(!adult || !data) && <span className="text-[11px] text-muted text-center sm:text-right">Tick both boxes to continue</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
