"use client";
import { useState } from "react";
import { AtSign, Check, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { checkInstagram, instagramUrl, type Instagram } from "@/lib/social";

/**
 * Optional Instagram username. Syntax check only: Piper never fetches,
 * scrapes or reads Instagram, and the username proves nothing about identity.
 */
export function InstagramField({
  value,
  onSave,
}: {
  value: Instagram | null;
  onSave: (next: Instagram | null) => void;
}) {
  const [draft, setDraft] = useState(value ? `@${value.handle}` : ""),
    [visible, setVisible] = useState(value?.visibleToMatches ?? false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const check = draft.trim() ? checkInstagram(draft) : null;
  function save() {
    setSaved("");
    const r = checkInstagram(draft);
    if (!r.ok) return setError(r.error);
    setError("");
    onSave({ handle: r.handle, visibleToMatches: visible });
    setDraft(`@${r.handle}`);
    setSaved(
      visible
        ? "Saved. Potential matches can see this link. It isn’t verified."
        : "Saved privately. Only you can see it until you turn on visibility.",
    );
  }
  return (
    <section
      className="instagram-section data-controls"
      aria-labelledby="ig-title"
    >
      <div className="instagram-field">
        <h3 id="ig-title">
          <AtSign size={16} /> Instagram <small>(optional)</small>
        </h3>
        <p className="muted">
          Add your username if you’d like matches to find you there. Piper never
          connects to, fetches or reads Instagram, and never asks for a
          password. Entering a username does not verify your identity or prove
          the account is yours.
        </p>
        <div className="instagram-row">
          <label className="sr-only" htmlFor="ig-handle">
            Instagram username
          </label>
          <input
            id="ig-handle"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            placeholder="@username"
            value={draft}
            aria-invalid={!!check && !check.ok}
            aria-describedby="ig-help"
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
              setSaved("");
            }}
          />
        </div>
        <small
          id="ig-help"
          className={check && !check.ok ? "error-text" : "muted"}
        >
          {check
            ? check.ok
              ? `Looks like a valid username: @${check.handle}`
              : check.error
            : "Letters, numbers, periods and underscores, up to 30 characters."}
        </small>
        <label className="check-label">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => {
              setVisible(e.target.checked);
              setSaved("");
            }}
          />
          Show this link to potential matches
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="saved-text">
            <Check size={14} /> {saved}
          </p>
        )}
        <div className="inline-actions">
          <Button size="sm" disabled={!check?.ok} onClick={save}>
            Save Instagram
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onSave(null);
                setDraft("");
                setVisible(false);
                setSaved(
                  "Removed. Your Instagram username is no longer stored.",
                );
              }}
            >
              <Trash2 size={14} /> Remove
            </Button>
          )}
          {value?.visibleToMatches && (
            <a
              className="instagram-link"
              href={instagramUrl(value.handle)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} /> How matches see it: @{value.handle} ·
              not verified
            </a>
          )}
        </div>
        <small className="fine-print">
          <ShieldCheck size={12} /> Never shared with matchmaker agents, and
          hidden from everyone unless you turn visibility on.
        </small>
      </div>
    </section>
  );
}
