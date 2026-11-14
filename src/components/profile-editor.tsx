"use client";
import { useState } from "react";
import { Check, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { type MissingPreference } from "@/lib/onboarding";
import {
  type Profile,
  profileSchema,
  requiredMissing,
  genders,
  intentions,
  dimensionKeys,
  dimensionLabels,
  dimensionOptions,
  title,
} from "@/lib/profile";

export function ProfileEditor({
  profile,
  onSave,
  saveLabel = "Approve & meet your introductions",
  missingPreferences = [],
}: {
  profile: Profile;
  onSave: (profile: Profile) => void | Promise<void>;
  saveLabel?: string;
  missingPreferences?: MissingPreference[];
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget),
        str = (k: string) => String(form.get(k) ?? "").trim();
      const list = (k: string) => [
        ...new Set(
          str(k)
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      const attributes = Object.fromEntries(
        dimensionKeys.map((d) => [d, str(d) || null]),
      );
      const desired = Object.fromEntries(
        dimensionKeys.map((d) => [d, str(`desired-${d}`) || null]),
      );
      const next = profileSchema.parse({
        ...profile,
        name: str("name"),
        age: str("age") ? Number(str("age")) : null,
        gender: str("gender") || null,
        city: str("city"),
        intent: str("intent") || null,
        bio: str("bio"),
        interests: list("interests"),
        values: list("values"),
        attributes,
        preferences: {
          minAge: Number(str("minAge")),
          maxAge: Number(str("maxAge")),
          genders: form.getAll("genders"),
          locationMode: str("locationMode"),
          strictIntent: form.get("strictIntent") === "on",
          desired,
          hard: form.getAll("hard"),
        },
        approved: form.get("approved") === "on",
        readyToConnect: form.get("readyToConnect") === "on",
      });
      const missing = requiredMissing(next);
      if (missing.length)
        throw new Error(`Please complete: ${missing.join(", ")}.`);
      if (!next.approved)
        throw new Error(
          "Please approve your profile before receiving introductions.",
        );
      await onSave(next);
    } catch (error) {
      setError(
        error instanceof Error && !("issues" in error)
          ? error.message
          : "Check your age ranges, field lengths, and hard dealbreakers. Each dealbreaker needs a preferred answer.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <div className="notice sage-notice">
        <ShieldCheck size={20} />
        <p>
          <strong>Your words, with the final say.</strong> Review everything
          below. Blank fields are unknown, never assumed. Your interview is not
          included in this profile.
        </p>
      </div>
      <fieldset>
        <legend>The essentials</legend>
        <div className="form-grid">
          <label>
            First name
            <input
              name="name"
              defaultValue={profile.name}
              maxLength={50}
              required
              autoComplete="given-name"
            />
          </label>
          <label>
            Age
            <input
              name="age"
              type="number"
              min="18"
              max="100"
              defaultValue={profile.age ?? ""}
              required
            />
          </label>
          <label>
            Gender
            <select name="gender" defaultValue={profile.gender ?? ""} required>
              <option value="">Choose your gender</option>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {title(g)}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input
              name="city"
              defaultValue={profile.city}
              placeholder="e.g. Astana"
              maxLength={100}
              required
            />
          </label>
          <label className="wide">
            Relationship intention
            <select name="intent" defaultValue={profile.intent ?? ""} required>
              <option value="">What are you looking for?</option>
              {intentions.map((i) => (
                <option key={i} value={i}>
                  {title(i)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>A little more you</legend>
        <label>
          Your introduction
          <textarea
            name="bio"
            defaultValue={profile.bio}
            rows={3}
            maxLength={700}
          />
        </label>
        <div className="form-grid">
          <label>
            Interests <small>Separate with commas · up to 12</small>
            <input
              name="interests"
              defaultValue={profile.interests.join(", ")}
              placeholder="hiking, cooking, art"
            />
          </label>
          <label>
            Values <small>Separate with commas · up to 10</small>
            <input
              name="values"
              defaultValue={profile.values.join(", ")}
              placeholder="kindness, curiosity, family"
            />
          </label>
        </div>
        <div className="form-grid">
          {dimensionKeys.map((d) => (
            <label key={d}>
              {dimensionLabels[d]}
              <select name={d} defaultValue={profile.attributes[d] ?? ""}>
                <option value="">Not shared yet</option>
                {dimensionOptions[d].map((v) => (
                  <option key={v} value={v}>
                    {title(v)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Your kind of connection</legend>
        <p className="field-help">
          Choose the partner age range, location and intention settings that fit
          you. Unstated interview preferences need your explicit choice.
        </p>
        <div className="form-grid">
          <label>
            Minimum partner age
            <input
              type="number"
              name="minAge"
              min="18"
              max="100"
              defaultValue={
                missingPreferences.includes("minAge")
                  ? ""
                  : profile.preferences.minAge
              }
              required
            />
          </label>
          <label>
            Maximum partner age
            <input
              type="number"
              name="maxAge"
              min="18"
              max="100"
              defaultValue={
                missingPreferences.includes("maxAge")
                  ? ""
                  : profile.preferences.maxAge
              }
              required
            />
          </label>
        </div>
        <div className="field-label">Open to dating</div>
        <div className="checkbox-row">
          {genders.map((g) => (
            <label className="check-label" key={g}>
              <input
                type="checkbox"
                name="genders"
                value={g}
                defaultChecked={profile.preferences.genders.includes(g)}
              />
              {title(g)}
            </label>
          ))}
        </div>
        <label>
          Location
          <select
            name="locationMode"
            defaultValue={
              missingPreferences.includes("locationMode")
                ? ""
                : profile.preferences.locationMode
            }
            required
          >
            <option value="">Choose location preference</option>
            <option value="local">Same city</option>
            <option value="anywhere">Open to other cities</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            name="strictIntent"
            defaultChecked={
              missingPreferences.includes("strictIntent")
                ? false
                : profile.preferences.strictIntent
            }
          />
          Only introduce people with the same relationship intention
        </label>
        <div className="preference-table">
          <div className="preference-table-heading">
            <span>Partner preference</span>
            <span>Preferred answer</span>
            <span>Dealbreaker</span>
          </div>
          {dimensionKeys.map((d) => (
            <div className="preference-row" key={d}>
              <label htmlFor={`desired-${d}`}>{dimensionLabels[d]}</label>
              <select
                id={`desired-${d}`}
                name={`desired-${d}`}
                defaultValue={profile.preferences.desired[d] ?? ""}
              >
                <option value="">No preference</option>
                {dimensionOptions[d].map((v) => (
                  <option key={v} value={v}>
                    {title(v)}
                  </option>
                ))}
              </select>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="hard"
                  value={d}
                  aria-label={`${dimensionLabels[d]} is a hard dealbreaker`}
                  defaultChecked={profile.preferences.hard.includes(d)}
                />
                <span>Required</span>
              </label>
            </div>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            name="readyToConnect"
            defaultChecked={profile.readyToConnect !== false}
          />
          Ready to Connect: open to new introductions (pause anytime; existing
          connections stay)
        </label>
        <p className="field-help">
          Confirmed dealbreaker conflicts exclude an introduction. An unknown
          answer stays visible as a question, not a presumed match.
        </p>
      </fieldset>
      {missingPreferences.length > 0 && (
        <div className="notice">
          <div>
            <strong>Some partner preferences were not provided.</strong>
            <p>
              Please enter your partner age range and location preference above,
              and choose whether the same intention is required.
            </p>
            <label className="check-label">
              <input type="checkbox" required />I explicitly confirm the partner
              age range, location and intention settings above.
            </label>
          </div>
        </div>
      )}
      <div className="approval-box">
        <label className="check-label">
          <input type="checkbox" name="approved" required />
          <span>
            <strong>I’ve reviewed this profile and approve sharing it.</strong>
            <br />
            <small>
              {profile.fictional
                ? "This is a fictional guest profile. It stays in this browser and is never shared with real members."
                : "This approved profile will be discoverable by eligible signed-in members."}
            </small>
          </span>
        </label>
      </div>
      {error && (
        <div className="notice error-notice" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <span>
          <Check size={15} /> You can edit this anytime
        </span>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : saveLabel}
          <ArrowRight size={17} />
        </Button>
      </div>
    </form>
  );
}
