import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-guard";
import { discoverVenues, osmProvider } from "@/lib/places/provider";
import { cityIds } from "@/lib/places/types";

export const runtime = "nodejs";
export const maxDuration = 45;

// One provider instance per server process, so its 24-hour cache and
// single-flight protection are shared by every request.
const osm = osmProvider();

/**
 * Optional live OpenStreetMap discovery, used only when the server enables it
 * (PLACES_OSM_LIVE=true). Public Overpass endpoints are best-effort and rate
 * limited, so results are cached and failures are reported, never hidden.
 * The guest demo never depends on this route: the curated dataset is bundled.
 */
export async function GET(req: NextRequest) {
  try {
    const city = z.enum(cityIds).parse(req.nextUrl.searchParams.get("city"));
    if (process.env.PLACES_OSM_LIVE !== "true")
      return NextResponse.json(
        { enabled: false, places: [], reports: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    const { places, reports } = await discoverVenues(city, [osm]);
    return NextResponse.json(
      {
        enabled: true,
        places,
        reports,
        attribution: "© OpenStreetMap contributors (ODbL)",
      },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
