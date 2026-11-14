/**
 * The four first-date discovery groups, and a deterministic mapping from
 * approved interests to them. Shared between the agent summary ("shared
 * activities"), the recommendation engine, and the interface.
 */
export const activityKinds = [
  "food-coffee",
  "parks-outdoors",
  "concerts-events",
  "culture-activities",
] as const;
export type ActivityKind = (typeof activityKinds)[number];
export const activityLabels: Record<ActivityKind, string> = {
  "food-coffee": "Food & Coffee",
  "parks-outdoors": "Parks & Outdoors",
  "concerts-events": "Concerts & Events",
  "culture-activities": "Culture & Activities",
};
const rules: [RegExp, ActivityKind][] = [
  [/coffee|tea|cook|food|baking|restaurant|wine|brunch|dessert/, "food-coffee"],
  [
    /hik|walk|outdoor|nature|garden|park|cycl|run|picnic|camp|ski|sail/,
    "parks-outdoors",
  ],
  [
    /music|concert|jazz|band|sing|danc|opera|ballet|comedy|stand-?up|festival|theat/,
    "concerts-events",
  ],
  [
    /art|museum|galler|photograph|histor|design|ceramic|read|book|film|movie|architect|craft/,
    "culture-activities",
  ],
];
/** The group an interest suggests, or null when nothing fits. */
export function interestActivity(interest: string): ActivityKind | null {
  const s = interest.toLocaleLowerCase("en-US");
  return rules.find(([r]) => r.test(s))?.[1] ?? null;
}
export function sharedActivityGroups(shared: string[]) {
  const out = new Map<ActivityKind, string[]>();
  for (const i of shared) {
    const kind = interestActivity(i);
    if (kind) out.set(kind, [...(out.get(kind) ?? []), i]);
  }
  return [...out.entries()].map(([kind, interests]) => ({ kind, interests }));
}
