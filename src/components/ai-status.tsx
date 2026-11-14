"use client";
import { useEffect, useState } from "react";
import { CircleOff, PlayCircle, Sparkles } from "lucide-react";
import type { GeminiStatus } from "@/lib/gemini-health";

/**
 * Reads the server's non-sensitive Gemini status (no Gemini request is made).
 * Cached briefly so re-renders and page navigation don't refetch.
 */
let cache: { at: number; value: GeminiStatus | null } | null = null;
let inflight: Promise<GeminiStatus | null> | null = null;
const TTL = 30000;
export function loadGeminiStatus(force = false): Promise<GeminiStatus | null> {
  if (!force && cache && Date.now() - cache.at < TTL)
    return Promise.resolve(cache.value);
  if (!force && inflight) return inflight;
  inflight = fetch("/api/ai/status", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<GeminiStatus>) : null))
    .catch(() => null)
    .then((value) => {
      cache = { at: Date.now(), value };
      inflight = null;
      return value;
    });
  return inflight;
}
export function invalidateGeminiStatus() {
  cache = null;
}
export function useGeminiStatus() {
  const [status, setStatus] = useState<GeminiStatus | null>(
    () => cache?.value ?? null,
  );
  useEffect(() => {
    let alive = true;
    void loadGeminiStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
export const liveUnavailable = (s: GeminiStatus | null) =>
  !!s &&
  (s.availability === "unavailable" || s.availability === "not-configured");
function until(iso: string | null) {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "";
  return ms > 90 * 60000
    ? ` · retry in about ${Math.round(ms / 3600000)} h`
    : ` · retry in about ${Math.max(1, Math.round(ms / 60000))} min`;
}
/** Always says plainly which mode an interaction is in. */
export function AIModeBadge({
  mode,
  status,
}: {
  mode: "live" | "scripted";
  status: GeminiStatus | null;
}) {
  if (mode === "scripted")
    return (
      <span className="ai-mode scripted" data-mode="scripted">
        <PlayCircle size={13} /> Scripted demonstration · no AI
      </span>
    );
  if (liveUnavailable(status))
    return (
      <span className="ai-mode unavailable" data-mode="unavailable">
        <CircleOff size={13} /> Live Gemini temporarily unavailable
        {until(status!.retryAt)}
      </span>
    );
  return (
    <span className="ai-mode live" data-mode="live">
      <Sparkles size={13} /> Live Gemini
      {status?.availability === "degraded" ? " · using fallback model" : ""}
    </span>
  );
}
