import { z } from "zod";

/**
 * Optional Instagram username. This is a self-reported link and nothing more:
 * entering it does not verify identity or prove ownership, Piper never fetches,
 * scrapes or reads Instagram, and it never asks for passwords or sessions. It
 * is kept separate from the profile so matchmaker agents never receive it, and
 * it is hidden from others unless the person turns visibility on.
 */
export const INSTAGRAM_MAX = 30;
/** Trim, drop one leading "@", lowercase. */
export const normalizeInstagram = (raw: string) =>
  raw.trim().replace(/^@/, "").toLowerCase();

export type InstagramCheck =
  { ok: true; handle: string } | { ok: false; error: string };
/** Syntax check only (Instagram's public username rules). */
export function checkInstagram(raw: string): InstagramCheck {
  const value = raw.trim();
  if (!value)
    return { ok: false, error: "Enter a username, or leave this empty." };
  if (/[/:]|instagram\.com|^www\./i.test(value))
    return {
      ok: false,
      error: "Enter just the username (for example @jamie.hikes), not a link.",
    };
  const handle = normalizeInstagram(value);
  if (handle.length < 1 || handle.length > INSTAGRAM_MAX)
    return { ok: false, error: "Usernames are 1–30 characters." };
  if (!/^[a-z0-9._]+$/.test(handle))
    return {
      ok: false,
      error: "Use only letters, numbers, periods and underscores.",
    };
  if (handle.startsWith(".") || handle.endsWith(".") || handle.includes(".."))
    return {
      ok: false,
      error:
        "A username can't start or end with a period, or use two in a row.",
    };
  return { ok: true, handle };
}
export const instagramHandleSchema = z
  .string()
  .max(40)
  .transform((s, ctx) => {
    const r = checkInstagram(s);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.handle;
  });
export const instagramSchema = z.object({
  handle: instagramHandleSchema,
  /** Off by default: only shown to potential matches when switched on. */
  visibleToMatches: z.boolean(),
});
export type Instagram = z.infer<typeof instagramSchema>;
export const socialSchema = z.object({ instagram: instagramSchema.nullable() });
export type Social = z.infer<typeof socialSchema>;
export const emptySocial = (): Social => ({ instagram: null });
export const instagramUrl = (handle: string) =>
  `https://www.instagram.com/${encodeURIComponent(handle)}/`;
/** What another person may see. Hidden unless visibility is on. */
export const visibleInstagram = (s: Social | null | undefined) =>
  s?.instagram?.visibleToMatches ? s.instagram.handle : null;
