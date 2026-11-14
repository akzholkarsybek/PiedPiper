/** Frontend types for the JSON returned by the Python backend (backend/app). Keep in sync. */

export type Gender = "man" | "woman" | "nonbinary";
export type LookingFor = "men" | "women" | "everyone";
export type Intent = "serious" | "casual" | "open";
export type MoneyStyle = "saver" | "balanced" | "spender";

export interface MoneyProfile {
  style: MoneyStyle;
  /** e.g. "Splits 50/50", "Likes to treat on first dates" */
  splitBill: string;
  /** e.g. "Paying off student loans aggressively" */
  debtAttitude: string;
  /** e.g. "Saving for a house in 3 years" */
  goals: string;
}

export interface Profile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  lookingFor: LookingFor;
  ageMin: number;
  ageMax: number;
  city: string;
  intent: Intent;
  occupation: string;
  /** One-line public bio */
  bio: string;
  /** How the agent should sound: humor, energy, quirks */
  voice: string;
  values: string[];
  interests: string[];
  dealbreakers: string[];
  money: MoneyProfile;
  /** Things the agent knows but must NOT bring up on the first date */
  privateNotes: string;
  /** Their type, in their own words. Only their own agent sees it (owner view only). */
  idealType?: string;
  /** Photo URL (demo profiles) or small data: URL (uploaded at onboarding). Optional. */
  photo?: string | null;
  /** Demo profiles that ship with the app (no real human behind them) */
  isSeed: boolean;
  createdAt: number;
}

export type Speaker = "a" | "b";

export interface Turn {
  speaker: Speaker;
  text: string;
  /** true if this turn followed a coach-mode nudge from the human */
  nudged?: boolean;
  /** live chemistry meter reading right after this message */
  vibe?: Vibe;
}

export interface Vibe {
  score: number;
  label: string;
}

export interface Verdict {
  scores: { chemistry: number; values: number; lifestyle: number; money: number };
  overall: number;
  decision: "yes" | "no";
  headline: string;
  why: string[];
  redFlags: string[];
  moneyNotes: string;
  bestMoment: string;
  noteToHuman: string;
}

export type DateStatus = "pending" | "running" | "done" | "error";

export interface DateRecord {
  id: string;
  aId: string;
  bId: string;
  status: DateStatus;
  transcript: Turn[];
  verdictA?: Verdict;
  verdictB?: Verdict;
  matchId?: string;
  startedAt?: number;
  createdAt: number;
}

export interface Match {
  id: string;
  aId: string;
  bId: string;
  dateId: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  at: number;
}

export type PublicProfile = Omit<Profile, "privateNotes" | "idealType">;

/** What one viewer is allowed to see of a date (see backend/app/view.py). */
export interface DateView {
  id: string;
  status: DateStatus;
  venue: string;
  transcript: Turn[];
  a: PublicProfile;
  b: PublicProfile;
  viewerSide: Speaker | null;
  verdictA: Verdict | null;
  verdictB: Verdict | null;
  matchId: string | null;
  createdAt: number;
}

/** Events streamed to the browser while a date runs */
export type DateEvent =
  | { type: "start"; date: DateView }
  | { type: "typing"; speaker: Speaker }
  | { type: "turn"; turn: Turn; index: number }
  | { type: "vibe"; index: number; vibe: Vibe }
  | { type: "deliberating" }
  | { type: "verdict"; side: Speaker; verdict: Verdict }
  | { type: "done"; date: DateView }
  | { type: "error"; message: string };
