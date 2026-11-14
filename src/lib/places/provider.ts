import { curatedEvents, curatedPlaces } from "./curated";
import {
  cities,
  isSafeLink,
  placeSchema,
  type CityId,
  type DateEvent,
  type Place,
} from "./types";

/**
 * Modular place/event providers. The curated provider always works offline
 * (guest demo). Live providers are optional, cached, and isolated: if one
 * fails, the others still return results and the failure is reported.
 */
export interface VenueProvider {
  id: string;
  label: string;
  kind: "curated" | "live";
  places(city: CityId): Promise<Place[]>;
  events(city: CityId): Promise<DateEvent[]>;
}
export const curatedProvider: VenueProvider = {
  id: "curated",
  label: "Curated & verified (OpenStreetMap + Ticketon, 2026-11-14)",
  kind: "curated",
  places: async (city) => curatedPlaces.filter((p) => p.city === city),
  events: async (city) => curatedEvents.filter((e) => e.city === city),
};

// ---------- Optional live OpenStreetMap (Overpass) provider ----------
type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
const categoryOf = (t: Record<string, string>): Place["category"] | null =>
  t.amenity === "cafe"
    ? "cafe"
    : t.amenity === "restaurant"
      ? "restaurant"
      : t.leisure === "park"
        ? "park"
        : t.tourism === "museum"
          ? "museum"
          : t.tourism === "gallery"
            ? "gallery"
            : null;
/** Map one OSM element to a Place, using only tags that are present. */
export function placeFromOsm(el: OsmElement, city: CityId): Place | null {
  const t = el.tags ?? {};
  const category = categoryOf(t);
  const local = t.name?.trim();
  if (!category || !local) return null;
  const lat = el.lat ?? el.center?.lat,
    lon = el.lon ?? el.center?.lon;
  const street = [t["addr:street"], t["addr:housenumber"]]
    .filter(Boolean)
    .join(" ");
  const website = t.website || t["contact:website"] || null;
  const url = `https://www.openstreetmap.org/${el.type}/${el.id}`;
  const parsed = placeSchema.safeParse({
    id: `osm-${el.type}-${el.id}`,
    type: "place",
    name: t["name:en"]?.trim() || local,
    localName: t["name:en"] ? local : null,
    city,
    country: cities[city].country,
    category,
    kind:
      category === "cafe" || category === "restaurant"
        ? "food-coffee"
        : category === "park"
          ? "parks-outdoors"
          : "culture-activities",
    setting: category === "park" ? "outdoor" : "indoor",
    address: street || null,
    localAddress: street || null,
    coordinates:
      typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null,
    website: website && isSafeLink(website) ? website : null,
    mapUrl: url,
    // Only an explicit fee=no tag counts as free; otherwise unknown.
    price: t.fee === "no" ? "free" : null,
    tags: [category, ...(t.cuisine ? t.cuisine.split(";").slice(0, 4) : [])]
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
    source: {
      name: "OpenStreetMap (live)",
      url,
      attribution: "© OpenStreetMap contributors (ODbL)",
      kind: "live",
    },
    lastVerified: new Date().toISOString().slice(0, 10),
  });
  return parsed.success ? parsed.data : null;
}
export function overpassQuery(city: CityId) {
  const [s, w, n, e] = cities[city].bbox;
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:25];(nwr(${b})["amenity"~"^(cafe|restaurant)$"]["name"]["website"];nwr(${b})["tourism"~"^(museum|gallery)$"]["name"];nwr(${b})["leisure"="park"]["name"]["wikidata"];);out center tags 60;`;
}
export function osmProvider(
  options: {
    fetchImpl?: typeof fetch;
    endpoint?: string;
    ttlMs?: number;
    now?: () => number;
  } = {},
): VenueProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint =
    options.endpoint ??
    process.env.OVERPASS_URL ??
    "https://overpass-api.de/api/interpreter";
  const ttl = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const now = options.now ?? (() => Date.now());
  const cache = new Map<CityId, { at: number; places: Place[] }>();
  const inflight = new Map<CityId, Promise<Place[]>>();
  return {
    id: "osm-live",
    label: "OpenStreetMap (live, cached 24 h)",
    kind: "live",
    async places(city) {
      const hit = cache.get(city);
      if (hit && now() - hit.at < ttl) return hit.places;
      // One request per city at a time; concurrent callers share it.
      const running = inflight.get(city);
      if (running) return running;
      const request = (async () => {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "PiedPiper-demo/0.2 (cached place discovery)",
          },
          body: new URLSearchParams({ data: overpassQuery(city) }).toString(),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`OSM provider HTTP ${res.status}`);
        const json = (await res.json()) as { elements?: OsmElement[] };
        const places = (json.elements ?? [])
          .map((el) => placeFromOsm(el, city))
          .filter((p): p is Place => !!p)
          .slice(0, 60);
        cache.set(city, { at: now(), places });
        return places;
      })();
      inflight.set(city, request);
      try {
        return await request;
      } finally {
        inflight.delete(city);
      }
    },
    events: async () => [],
  };
}

export type ProviderReport = {
  id: string;
  label: string;
  kind: "curated" | "live";
  ok: boolean;
  places: number;
  events: number;
};
/** Query providers independently; one failing never hides the others. */
export async function discoverVenues(city: CityId, providers: VenueProvider[]) {
  const places = new Map<string, Place>(),
    events = new Map<string, DateEvent>();
  const reports: ProviderReport[] = [];
  for (const p of providers) {
    try {
      const [ps, es] = await Promise.all([p.places(city), p.events(city)]);
      // Curated records come first and win over live duplicates.
      for (const x of ps) if (!places.has(x.id)) places.set(x.id, x);
      for (const x of es) if (!events.has(x.id)) events.set(x.id, x);
      reports.push({
        id: p.id,
        label: p.label,
        kind: p.kind,
        ok: true,
        places: ps.length,
        events: es.length,
      });
    } catch {
      reports.push({
        id: p.id,
        label: p.label,
        kind: p.kind,
        ok: false,
        places: 0,
        events: 0,
      });
    }
  }
  return {
    places: [...places.values()],
    events: [...events.values()],
    reports,
  };
}
