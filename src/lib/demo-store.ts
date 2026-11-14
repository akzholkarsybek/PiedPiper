"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { demoProfiles } from "./fixtures";
import { profileSchema, type Profile, type Dimension } from "./profile";
import {
  answerInvestigation,
  canMessage,
  DEFAULT_WEIGHTS,
  eligibility,
  isMutual,
  missingInformation,
} from "./matching";

export const storageKey = "pied-piper:fictional-demo:v1";
const decisionSchema = z.enum(["interested", "pass"]);
const stateSchema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  candidates: z.array(profileSchema),
  decisions: z.record(z.string(), decisionSchema),
  counterparts: z.record(z.string(), decisionSchema),
  questions: z.record(z.string(), z.enum(["declined", "shared"])),
  messages: z.array(
    z.object({
      id: z.string(),
      peerId: z.string(),
      sender: z.enum(["you", "synthetic"]),
      text: z.string().max(2000),
      at: z.string(),
    }),
  ),
  feedback: z.array(
    z.object({ peerId: z.string(), reason: z.string(), at: z.string() }),
  ),
  reports: z.array(
    z.object({ peerId: z.string(), reason: z.string(), at: z.string() }),
  ),
  weights: z.object({
    goals: z.number(),
    lifestyle: z.number(),
    interests: z.number(),
    values: z.number(),
    reciprocal: z.number(),
  }),
});
export type DemoState = z.infer<typeof stateSchema>;
export function initialDemo(): DemoState {
  return {
    version: 1,
    profile: null,
    candidates: structuredClone(demoProfiles),
    decisions: {},
    counterparts: {},
    questions: {},
    messages: [],
    feedback: [],
    reports: [],
    weights: { ...DEFAULT_WEIGHTS },
  };
}
export type DemoAction =
  | { type: "profile"; profile: Profile }
  | {
      type: "decision";
      id: string;
      decision: "interested" | "pass";
      reason?: string;
      prioritizeInterests?: boolean;
    }
  | { type: "counterpart"; id: string; decision: "interested" | "pass" }
  | {
      type: "answer";
      id: string;
      subjectId: string;
      dimension: Dimension;
      answer: string;
      consent: boolean;
    }
  | { type: "message"; id: string; text: string; synthetic?: boolean }
  | { type: "block"; id: string; report?: string }
  | { type: "reset-decisions" };
export function matched(state: DemoState, id: string) {
  const peer = state.candidates.find((c) => c.id === id);
  return (
    !!state.profile &&
    !!peer &&
    !state.profile.blockedIds.includes(id) &&
    !peer.blockedIds.includes(state.profile.id) &&
    isMutual(state.decisions[id], state.counterparts[id])
  );
}
export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "profile")
    return {
      ...state,
      profile: profileSchema.parse({
        ...action.profile,
        fictional: true,
        id: "guest",
      }),
    };
  if (action.type === "reset-decisions")
    return { ...state, decisions: {}, counterparts: {} };
  if (!state.profile) throw new Error("Review and approve your profile first.");
  const peer = state.candidates.find((c) => c.id === action.id);
  if (!peer) throw new Error("This profile is not available.");
  if (action.type === "block")
    return {
      ...state,
      profile: {
        ...state.profile,
        blockedIds: [...new Set([...state.profile.blockedIds, action.id])],
      },
      reports: action.report
        ? [
            ...state.reports,
            {
              peerId: action.id,
              reason: action.report,
              at: new Date().toISOString(),
            },
          ]
        : state.reports,
    };
  if (action.type === "decision") {
    if (!eligibility(state.profile, peer).eligible)
      throw new Error(
        "This introduction no longer meets your mutual requirements.",
      );
    return {
      ...state,
      decisions: { ...state.decisions, [action.id]: action.decision },
      weights: action.prioritizeInterests
        ? { ...state.weights, interests: 30 }
        : state.weights,
      feedback: action.reason
        ? [
            ...state.feedback,
            {
              peerId: action.id,
              reason: action.reason,
              at: new Date().toISOString(),
            },
          ]
        : state.feedback,
    };
  }
  if (action.type === "counterpart") {
    if (
      state.decisions[action.id] !== "interested" ||
      !eligibility(state.profile, peer).eligible
    )
      throw new Error("Express interest in an eligible profile first.");
    return {
      ...state,
      counterparts: { ...state.counterparts, [action.id]: action.decision },
    };
  }
  if (action.type === "answer") {
    const q = missingInformation(state.profile, peer).find(
      (q) =>
        q.subjectId === action.subjectId && q.dimension === action.dimension,
    );
    if (!q || state.questions[q.key])
      throw new Error(
        "This question has already been handled or is no longer relevant.",
      );
    const subject = q.subjectId === state.profile.id ? state.profile : peer;
    const updated = answerInvestigation(
      subject,
      q.dimension,
      action.answer,
      action.consent,
    );
    return {
      ...state,
      profile: subject.id === state.profile.id ? updated : state.profile,
      candidates: state.candidates.map((c) =>
        c.id === subject.id ? updated : c,
      ),
      questions: {
        ...state.questions,
        [q.key]: action.consent ? "shared" : "declined",
      },
    };
  }
  if (action.type === "message") {
    const text = action.text.trim();
    if (!text || text.length > 2000)
      throw new Error("Messages must be between 1 and 2,000 characters.");
    if (
      !canMessage(
        state.profile.id,
        [state.profile.id, peer.id],
        matched(state, peer.id),
        state.profile.blockedIds.includes(peer.id),
      )
    )
      throw new Error("Messaging requires an unblocked mutual connection.");
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          peerId: action.id,
          sender: action.synthetic ? "synthetic" : "you",
          text,
          at: new Date().toISOString(),
        },
      ],
    };
  }
  return state;
}
const serverState = initialDemo();
let snapshot = serverState,
  hydrated = false;
let storageError = "";
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}
function getSnapshot() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) snapshot = stateSchema.parse(JSON.parse(raw));
    } catch {
      storageError =
        "Saved demo data could not be read. This session is starting fresh.";
    }
  }
  return snapshot;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useDemo() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}
export function getStorageError() {
  return storageError;
}
export function dispatchDemo(action: DemoAction) {
  snapshot = reduceDemo(getSnapshot(), action);
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    storageError = "";
  } catch {
    storageError =
      "Browser storage is unavailable or full. Changes will last only for this visit.";
  }
  emit();
}
export function deleteDemo() {
  snapshot = initialDemo();
  try {
    localStorage.removeItem(storageKey);
  } catch {
    storageError =
      "Browser storage could not be cleared. Clear site data in browser settings.";
  }
  emit();
}
