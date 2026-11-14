import { z } from "zod";
import { activityKinds } from "../activities";

/**
 * Real-world places and events for first-date discovery.
 *
 * Every record carries its source and the date it was last verified. Fields
 * that were not verified are null and are shown as "not listed", never
 * guessed: no invented names, addresses, coordinates, prices, ratings or
 * opening hours, and nothing implies a place is open or tickets are available.
 */
export const cityIds = ["astana", "almaty"] as const;
export type CityId = (typeof cityIds)[number];
export type CityConfig = {
  id: CityId;
  name: string;
  country: string;
  countryCode: string;
  timeZone: string;
  currency: string;
  /** Approximate bounding box (south, west, north, east) for live providers. */
  bbox: [number, number, number, number];
  /** Budget bands in the local currency, used only for verified prices. */
  budgetMax: { free: number; low: number; moderate: number };
};
// Adding a city (e.g. a US city later) means adding an entry here and data or
// a provider for it; the engine and interface are city-agnostic.
export const cities: Record<CityId, CityConfig> = {
  astana: {
    id: "astana",
    name: "Astana",
    country: "Kazakhstan",
    countryCode: "KZ",
    timeZone: "Asia/Almaty",
    currency: "KZT",
    bbox: [51.05, 71.3, 51.22, 71.55],
    budgetMax: { free: 0, low: 5000, moderate: 15000 },
  },
  almaty: {
    id: "almaty",
    name: "Almaty",
    country: "Kazakhstan",
    countryCode: "KZ",
    timeZone: "Asia/Almaty",
    currency: "KZT",
    bbox: [43.18, 76.8, 43.33, 77.02],
    budgetMax: { free: 0, low: 5000, moderate: 15000 },
  },
};
export const DEFAULT_CITY: CityId = "astana";

export const placeCategories = [
  "cafe",
  "restaurant",
  "park",
  "museum",
  "gallery",
  "venue",
] as const;
export const eventCategories = [
  "concert",
  "performance",
  "comedy",
  "exhibition",
  "theatre",
] as const;

const sourceSchema = z.object({
  /** e.g. "OpenStreetMap", "Ticketon (manually verified)", "Official website". */
  name: z.string().min(1).max(80),
  /** Where the record can be checked. */
  url: z.url().max(400),
  /** ODbL attribution etc. */
  attribution: z.string().max(160).nullable(),
  kind: z.enum(["curated", "live"]),
});
const priceSchema = z
  .object({
    /** Lowest listed price at verification time, in `currency`. */
    from: z.number().int().min(0),
    currency: z.string().length(3),
    note: z.string().max(160),
  })
  .nullable();

export const placeSchema = z.object({
  id: z.string().min(3).max(80),
  type: z.literal("place"),
  name: z.string().min(1).max(120),
  /** The name as recorded by the source, when it differs (e.g. Kazakh/Russian). */
  localName: z.string().max(120).nullable(),
  city: z.enum(cityIds),
  country: z.string().max(60),
  category: z.enum(placeCategories),
  kind: z.enum(activityKinds),
  setting: z.enum(["indoor", "outdoor"]),
  address: z.string().max(160).nullable(),
  localAddress: z.string().max(160).nullable(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    })
    .nullable(),
  website: z.url().max(300).nullable(),
  mapUrl: z.url().max(400),
  /** Only "free" when that is reliable (e.g. a public park); otherwise null. */
  price: z.union([z.literal("free"), priceSchema]),
  tags: z.array(z.string().max(30)).max(12),
  source: sourceSchema,
  lastVerified: z.iso.date(),
});
export type Place = z.infer<typeof placeSchema>;

export const eventSchema = z.object({
  id: z.string().min(3).max(80),
  type: z.literal("event"),
  title: z.string().min(1).max(160),
  city: z.enum(cityIds),
  country: z.string().max(60),
  category: z.enum(eventCategories),
  kind: z.enum(activityKinds),
  setting: z.enum(["indoor", "outdoor"]),
  venue: z.string().max(120).nullable(),
  address: z.string().max(160).nullable(),
  /** Single performance: start with an explicit UTC offset. */
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  /** Duration in minutes when listed; otherwise null (we assume nothing). */
  durationMinutes: z.number().int().min(15).max(600).nullable(),
  /** For exhibitions running over a period with daily hours. */
  run: z
    .object({
      from: z.iso.date(),
      to: z.iso.date(),
      dailyOpen: z.string().regex(/^\d\d:\d\d$/),
      dailyClose: z.string().regex(/^\d\d:\d\d$/),
    })
    .nullable(),
  timeZone: z.string().max(64),
  /** False when the source showed day and month but not the year. */
  yearShownOnSource: z.boolean(),
  price: priceSchema,
  ageRestriction: z.string().max(10).nullable(),
  url: z.url().max(400),
  note: z.string().max(240).nullable(),
  tags: z.array(z.string().max(30)).max(12),
  source: sourceSchema,
  lastVerified: z.iso.date(),
});
export type DateEvent = z.infer<typeof eventSchema>;
export type Venue = Place | DateEvent;

/**
 * Accepts only http(s) links without credentials. For ticketing links the
 * host must be the official site itself (no look-alike or proxy hosts).
 */
export function isSafeLink(url: string, officialHosts?: string[]) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    if (!officialHosts) return true;
    const host = u.hostname.toLowerCase();
    return officialHosts.some((h) => host === h || host === `www.${h}`);
  } catch {
    return false;
  }
}
export const TICKETON_HOSTS = ["ticketon.kz"];
