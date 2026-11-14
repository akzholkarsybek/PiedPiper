/** Where an agent date happens. Keep ids in sync with VENUES in backend/app/agents.py. */
export const VENUES = [
  { id: "cafe", emoji: "☕", label: "Cozy café" },
  { id: "hiking", emoji: "🥾", label: "Hiking trail" },
  { id: "karaoke", emoji: "🎤", label: "Karaoke" },
  { id: "museum", emoji: "🖼️", label: "Art museum" },
  { id: "dinner", emoji: "🍝", label: "Dinner" },
  { id: "skating", emoji: "⛸️", label: "Ice skating" },
] as const;

export type VenueId = (typeof VENUES)[number]["id"];

export function venueOf(id: string | null | undefined) {
  return VENUES.find((v) => v.id === id) ?? VENUES[0];
}

/** Text + colour for the live chemistry meter. */
export function vibeTone(score: number) {
  if (score >= 75) return { bar: "bg-grad", text: "text-rose" };
  if (score >= 55) return { bar: "bg-rose", text: "text-rose" };
  if (score >= 40) return { bar: "bg-plum", text: "text-plum" };
  return { bar: "bg-coral", text: "text-coral" };
}
