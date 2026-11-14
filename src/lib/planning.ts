import { z } from "zod";

/**
 * Mutual availability and first-date planning data.
 *
 * Availability is a *general weekly pattern* in the person's own IANA time
 * zone. It is never inferred: no entry means unknown, not "free". Overlap is
 * computed deterministically by converting each weekly window into absolute
 * UTC instants for a concrete upcoming week (so DST and different time zones
 * are handled correctly), then intersecting the two interval lists.
 */
export const weekdays = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof weekdays)[number];
export const weekdayLabels: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
export const timeWindows = {
  morning: { label: "Morning", start: "08:00", end: "12:00" },
  afternoon: { label: "Afternoon", start: "12:00", end: "17:00" },
  evening: { label: "Evening", start: "17:00", end: "22:00" },
} as const;
export type TimeWindow = keyof typeof timeWindows;
export const timeWindowKeys = Object.keys(timeWindows) as TimeWindow[];

const hhmm = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Use HH:MM (24-hour).");
export const toMinutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export const slotSchema = z
  .object({ day: z.enum(weekdays), start: hhmm, end: hhmm })
  .refine((s) => toMinutes(s.start) < toMinutes(s.end), {
    message: "A time window must end after it starts.",
  });
export type Slot = z.infer<typeof slotSchema>;

export const availabilitySchema = z.object({
  timeZone: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, { message: "Unknown time zone." }),
  slots: z.array(slotSchema).max(28),
  openToMeetingSoon: z.boolean().nullable(),
  preference: z.enum(["weekday", "weekend", "either"]).nullable(),
  /** Explicit consent to show this general availability to mutual connections. */
  shareWithMatches: z.boolean(),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const dateCategories = [
  "coffee",
  "restaurant",
  "museum",
  "walk",
  "sport",
  "cultural-event",
  "shared-interest",
] as const;
export type DateCategory = (typeof dateCategories)[number];
export const dateCategoryLabels: Record<DateCategory, string> = {
  coffee: "Coffee",
  restaurant: "Restaurants",
  museum: "Museums & galleries",
  walk: "Walks in public places",
  sport: "Sporting activities",
  "cultural-event": "Cultural events",
  "shared-interest": "A shared interest",
};
/** Relative budget levels only. We never show or invent prices. */
export const budgetLevels = ["free", "low", "moderate", "flexible"] as const;
export const budgetLabels: Record<(typeof budgetLevels)[number], string> = {
  free: "Free or nearly free",
  low: "Budget-friendly",
  moderate: "Moderate",
  flexible: "Flexible",
};
export const datePreferencesSchema = z.object({
  budget: z.enum(budgetLevels).nullable(),
  activityTypes: z.array(z.enum(dateCategories)).max(dateCategories.length),
});
export type DatePreferences = z.infer<typeof datePreferencesSchema>;

export const planningSchema = z.object({
  availability: availabilitySchema.nullable(),
  datePreferences: datePreferencesSchema,
});
export type Planning = z.infer<typeof planningSchema>;
export const emptyPlanning = (): Planning => ({
  availability: null,
  datePreferences: { budget: null, activityTypes: [] },
});

/** Build slots from the simple weekly grid used by the editor. */
export function slotsFromGrid(grid: Partial<Record<Weekday, TimeWindow[]>>) {
  return weekdays.flatMap((day) =>
    (grid[day] ?? []).map((w) => ({
      day,
      start: timeWindows[w].start,
      end: timeWindows[w].end,
    })),
  );
}
export function gridHas(slots: Slot[], day: Weekday, w: TimeWindow) {
  const win = timeWindows[w];
  return slots.some(
    (s) =>
      s.day === day &&
      toMinutes(s.start) <= toMinutes(win.start) &&
      toMinutes(s.end) >= toMinutes(win.end),
  );
}

// ---------- Time-zone arithmetic (Intl only; no external services) ----------
const formatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(tz: string, utcMs: number) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  const parts = f.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}
/** Offset (ms) of `tz` from UTC at the given instant. */
export function timeZoneOffsetMs(tz: string, utcMs: number) {
  const p = partsIn(tz, utcMs);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}
/** Convert a wall-clock time in `tz` to a UTC instant (handles DST shifts). */
export function zonedTimeToUtc(
  tz: string,
  year: number,
  month: number,
  day: number,
  minutes: number,
) {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const first = guess - timeZoneOffsetMs(tz, guess);
  const second = guess - timeZoneOffsetMs(tz, first);
  return second;
}

export type Interval = { start: string; end: string };
type MsInterval = { start: number; end: number };
const DAY_INDEX: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Concrete UTC intervals for a person's weekly pattern within [from, to). */
export function weeklyToIntervals(
  availability: Availability,
  fromMs: number,
  toMs: number,
): MsInterval[] {
  const { timeZone } = availability;
  const start = partsIn(timeZone, fromMs);
  const result: MsInterval[] = [];
  const days = Math.ceil((toMs - fromMs) / 86400000) + 2;
  for (let i = -1; i < days; i++) {
    // Civil-date arithmetic in UTC avoids host time-zone effects.
    const civil = new Date(
      Date.UTC(start.year, start.month - 1, start.day + i),
    );
    const weekday = DAY_INDEX[civil.getUTCDay()];
    for (const slot of availability.slots) {
      if (slot.day !== weekday) continue;
      const y = civil.getUTCFullYear(),
        m = civil.getUTCMonth() + 1,
        d = civil.getUTCDate();
      const s = zonedTimeToUtc(timeZone, y, m, d, toMinutes(slot.start));
      const e = zonedTimeToUtc(timeZone, y, m, d, toMinutes(slot.end));
      const clippedStart = Math.max(s, fromMs),
        clippedEnd = Math.min(e, toMs);
      if (clippedEnd > clippedStart)
        result.push({ start: clippedStart, end: clippedEnd });
    }
  }
  return mergeIntervals(result);
}
function mergeIntervals(list: MsInterval[]) {
  const sorted = [...list].sort((x, y) => x.start - y.start);
  const out: MsInterval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}
export function intersectIntervals(a: MsInterval[], b: MsInterval[]) {
  const out: MsInterval[] = [];
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start),
      end = Math.min(a[i].end, b[j].end);
    if (end > start) out.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

export type OverlapResult =
  | { status: "missing"; who: ("a" | "b")[] }
  | { status: "not-shared"; who: ("a" | "b")[] }
  | { status: "not-open"; who: ("a" | "b")[] }
  | { status: "no-overlap"; windows: [] }
  | { status: "ok"; windows: Interval[] };

/**
 * Deterministic overlap of two people's general availability.
 * Never assumes availability: missing data or missing consent yields no windows.
 */
export function computeOverlap(
  a: Availability | null | undefined,
  b: Availability | null | undefined,
  options: { from: Date; days?: number; minMinutes?: number },
): OverlapResult {
  const people = { a, b },
    sides = ["a", "b"] as const;
  const missing = sides.filter((k) => !people[k]?.slots.length);
  if (missing.length) return { status: "missing", who: [...missing] };
  const notShared = sides.filter((k) => !people[k]!.shareWithMatches);
  if (notShared.length) return { status: "not-shared", who: [...notShared] };
  const notOpen = sides.filter((k) => people[k]!.openToMeetingSoon === false);
  if (notOpen.length) return { status: "not-open", who: [...notOpen] };
  const fromMs = options.from.getTime(),
    toMs = fromMs + (options.days ?? 7) * 86400000,
    min = (options.minMinutes ?? 60) * 60000;
  const windows = intersectIntervals(
    weeklyToIntervals(a!, fromMs, toMs),
    weeklyToIntervals(b!, fromMs, toMs),
  )
    .filter((w) => w.end - w.start >= min)
    .map((w) => ({
      start: new Date(w.start).toISOString(),
      end: new Date(w.end).toISOString(),
    }));
  return windows.length
    ? { status: "ok", windows }
    : { status: "no-overlap", windows: [] };
}

export function formatWindow(w: Interval, tz: string, locale = "en-US") {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(w.start));
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time.format(new Date(w.start))} – ${time.format(new Date(w.end))}`;
}
/** A coarse label ("Saturday morning") that is safe to give an AI model. */
export function describeWindow(w: Interval, tz: string) {
  const p = partsIn(tz, Date.parse(w.start));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  }).format(new Date(w.start));
  const part = p.hour < 12 ? "morning" : p.hour < 17 ? "afternoon" : "evening";
  return `${weekday} ${part}`;
}
/** A proposal lasts up to two hours from the start of an overlap window. */
export function proposalSlot(w: Interval): Interval {
  const start = Date.parse(w.start),
    end = Math.min(Date.parse(w.end), start + 2 * 3600000);
  return { start: w.start, end: new Date(end).toISOString() };
}
export function withinWindows(slot: Interval, windows: Interval[]) {
  const s = Date.parse(slot.start),
    e = Date.parse(slot.end);
  return (
    e > s &&
    windows.some((w) => Date.parse(w.start) <= s && Date.parse(w.end) >= e)
  );
}

// ---------- Date proposals ----------
export const proposalStatuses = [
  "proposed",
  "accepted",
  "declined",
  "withdrawn",
] as const;
/**
 * A reference to a verified place or event from the places layer. Only ids,
 * names, links and source travel with a proposal; nothing is booked.
 */
export const venueRefSchema = z.object({
  kind: z.enum(["place", "event"]),
  id: z.string().min(3).max(80),
  name: z.string().min(1).max(160),
  address: z.string().max(160).nullable(),
  /** Official website/ticket page, or null when none is verified. */
  url: z.url().max(400).nullable(),
  mapUrl: z.url().max(400).nullable(),
  source: z.string().max(80),
  /** True when the time is the event's own scheduled time. */
  fixedTime: z.boolean(),
});
export type VenueRef = z.infer<typeof venueRefSchema>;
export const proposalSchema = z.object({
  id: z.string().min(1).max(100),
  peerId: z.string().min(1).max(100),
  activity: z.object({
    category: z.enum(dateCategories),
    title: z.string().min(1).max(160),
  }),
  /** Optional verified venue; older proposals have none. */
  venue: venueRefSchema.optional(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  proposedBy: z.enum(["you", "synthetic"]),
  status: z.enum(proposalStatuses),
  /** True when the counterpart's response was an explicit fictional simulation. */
  responseSimulated: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Proposal = z.infer<typeof proposalSchema>;
/** A proposal is only a confirmed date once both people have accepted it. */
export const isConfirmedDate = (p: Proposal) => p.status === "accepted";
export function proposalStatusLabel(p: Proposal) {
  return {
    proposed: "Proposed · not confirmed until both accept",
    accepted: p.responseSimulated
      ? "Confirmed by both · counterpart simulated"
      : "Confirmed by both",
    declined: p.responseSimulated ? "Declined · simulated" : "Declined",
    withdrawn: "Withdrawn",
  }[p.status];
}
