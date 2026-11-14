import { z } from "zod";

export const genders = ["woman", "man", "nonbinary"] as const;
export const intentions = ["long-term", "life-partner", "exploring"] as const;
export const dimensionKeys = [
  "children",
  "smoking",
  "drinking",
  "pace",
] as const;
export type Dimension = (typeof dimensionKeys)[number];
export const dimensionLabels: Record<Dimension, string> = {
  children: "Family plans",
  smoking: "Smoking",
  drinking: "Drinking",
  pace: "Everyday pace",
};
export const dimensionOptions = {
  children: ["yes", "no", "open"],
  smoking: ["yes", "no"],
  drinking: ["socially", "no", "often"],
  pace: ["active", "balanced", "quiet"],
} as const;
export const attributesSchema = z.object({
  children: z.enum(dimensionOptions.children).nullable(),
  smoking: z.enum(dimensionOptions.smoking).nullable(),
  drinking: z.enum(dimensionOptions.drinking).nullable(),
  pace: z.enum(dimensionOptions.pace).nullable(),
});
export const preferencesSchema = z
  .object({
    minAge: z.number().int().min(18).max(100),
    maxAge: z.number().int().min(18).max(100),
    genders: z.array(z.enum(genders)).max(3),
    locationMode: z.enum(["local", "anywhere"]),
    strictIntent: z.boolean(),
    desired: attributesSchema,
    hard: z.array(z.enum(dimensionKeys)).max(4),
  })
  .refine((p) => p.minAge <= p.maxAge, {
    message: "Minimum age must not exceed maximum age.",
  })
  .refine((p) => p.hard.every((d) => p.desired[d] !== null), {
    message: "Choose a partner preference for every hard dealbreaker.",
  });
export const profileSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(50),
  age: z.number().int().min(18).max(100).nullable(),
  gender: z.enum(genders).nullable(),
  city: z.string().max(100),
  intent: z.enum(intentions).nullable(),
  bio: z.string().max(700),
  interests: z.array(z.string().min(1).max(40)).max(12),
  values: z.array(z.string().min(1).max(40)).max(10),
  attributes: attributesSchema,
  preferences: preferencesSchema,
  approved: z.boolean(),
  fictional: z.boolean(),
  blockedIds: z.array(z.string()).max(1000),
});
export type Profile = z.infer<typeof profileSchema>;
export const emptyAttributes: Profile["attributes"] = {
  children: null,
  smoking: null,
  drinking: null,
  pace: null,
};
export function blankProfile(id = "guest"): Profile {
  return {
    id,
    name: "",
    age: null,
    gender: null,
    city: "",
    intent: null,
    bio: "",
    interests: [],
    values: [],
    attributes: { ...emptyAttributes },
    preferences: {
      minAge: 25,
      maxAge: 45,
      genders: [],
      locationMode: "local",
      strictIntent: true,
      desired: { ...emptyAttributes },
      hard: [],
    },
    approved: false,
    fictional: true,
    blockedIds: [],
  };
}
export function requiredMissing(p: Profile): string[] {
  return [
    !p.name.trim() && "name",
    !p.age && "adult age",
    !p.gender && "gender",
    !p.city.trim() && "city",
    !p.intent && "relationship intention",
    !p.preferences.genders.length && "dating preferences",
  ].filter(Boolean) as string[];
}
export function title(value: string | null | undefined) {
  return value
    ? value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not shared yet";
}
export function attributeLabel(d: Dimension, value: string | null) {
  if (!value) return "Not shared yet";
  if (d === "children")
    return (
      {
        yes: "Wants children",
        no: "Does not want children",
        open: "Open to discussing children",
      } as Record<string, string>
    )[value];
  if (d === "smoking") return value === "no" ? "Does not smoke" : "Smokes";
  if (d === "drinking")
    return value === "no" ? "Does not drink" : `Drinks ${value}`;
  return `${title(value)} pace`;
}
