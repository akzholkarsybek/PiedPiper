"use client";
import Link from "next/link";
import { useState } from "react";
import { Activity, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import {
  AIModeBadge,
  invalidateGeminiStatus,
  loadGeminiStatus,
  useGeminiStatus,
} from "./ai-status";
import type { GeminiStatus } from "@/lib/gemini-health";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

/**
 * Developer diagnostics. Shows only non-sensitive state: model names,
 * availability, the last error CATEGORY, cooldowns, and which mode applies.
 * Never shows keys, provider messages, prompts or profile data.
 */
export function Diagnostics() {
  const initial = useGeminiStatus();
  const [override, setOverride] = useState<GeminiStatus | null>(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  const status = override ?? initial;
  async function refresh() {
    invalidateGeminiStatus();
    setOverride(await loadGeminiStatus(true));
  }
  async function liveCheck() {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/ai/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check: true }),
      });
      const data = await res.json();
      if (!res.ok) setResult(data.error ?? "The live check could not run.");
      else {
        setResult(
          data.ok
            ? `Live request succeeded with ${data.model}.`
            : `Live request failed: ${data.error?.code ?? "UNKNOWN"} — ${data.error?.message ?? ""}`,
        );
        setOverride(data.status);
        invalidateGeminiStatus();
      }
    } catch {
      setResult("The diagnostics endpoint could not be reached.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="diagnostics">
      <header>
        <Brand />
        <span className="eyebrow">
          <Activity size={13} /> DEVELOPER DIAGNOSTICS
        </span>
      </header>
      <h1>Gemini status</h1>
      <p className="muted">
        Server-side, short-lived state from this process. Opening this page
        never calls Gemini.
      </p>
      {!status ? (
        <p role="status">
          <LoaderCircle className="spin" size={15} /> Loading…
        </p>
      ) : (
        <>
          <div className="ai-mode-row">
            <AIModeBadge mode="live" status={status} />
            {status.scriptedRecommended && (
              <AIModeBadge mode="scripted" status={status} />
            )}
          </div>
          <dl className="diag-grid">
            <dt>Configured</dt>
            <dd>{status.configured ? "Yes (key present, not shown)" : "No"}</dd>
            <dt>Selected model</dt>
            <dd>
              <code>{status.model ?? "—"}</code>
            </dd>
            <dt>Fallback model</dt>
            <dd>
              <code>{status.fallbackModel ?? "none"}</code>
            </dd>
            <dt>Availability</dt>
            <dd data-testid="diag-availability">{status.availability}</dd>
            <dt>Last error category</dt>
            <dd>{status.lastErrorCategory ?? "none"}</dd>
            <dt>Last error at</dt>
            <dd>{fmt(status.lastErrorAt)}</dd>
            <dt>Last success at</dt>
            <dd>{fmt(status.lastSuccessAt)}</dd>
            <dt>Fallback active</dt>
            <dd>{status.fallbackActive ? "Yes" : "No"}</dd>
            <dt>Scripted mode recommended</dt>
            <dd>{status.scriptedRecommended ? "Yes" : "No"}</dd>
          </dl>
          <table className="diag-models">
            <thead>
              <tr>
                <th>Model</th>
                <th>Role</th>
                <th>State</th>
                <th>Reason</th>
                <th>Until</th>
              </tr>
            </thead>
            <tbody>
              {status.models.map((m) => (
                <tr key={m.name}>
                  <td>
                    <code>{m.name}</code>
                  </td>
                  <td>{m.role}</td>
                  <td>{m.state}</td>
                  <td>{m.reason ?? "—"}</td>
                  <td>{fmt(m.until)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="inline-actions">
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw size={15} /> Refresh
        </Button>
        <Button disabled={busy} onClick={() => void liveCheck()}>
          {busy && <LoaderCircle className="spin" size={15} />} Run one minimal
          live request
        </Button>
      </div>
      {result && (
        <p role="status" className="diag-result">
          {result}
        </p>
      )}
      <p className="fine-print">
        <ShieldCheck size={14} /> The live check sends a tiny fixed prompt (no
        user data), counts against quota, and is limited to once a minute.{" "}
        <Link href="/">Back to Pied Piper</Link>
      </p>
    </main>
  );
}
