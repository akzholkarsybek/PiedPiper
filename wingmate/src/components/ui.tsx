import type { Profile, Verdict } from "@/lib/types";
import { Briefcase, Check, Coins, Flag, Heart, MapPin, Quote } from "./icons";

type PublicProfile = Omit<Profile, "privateNotes"> & { privateNotes?: string };

// ---------------------------------------------------------------------------
// Per-person gradient identity (we have no photos, so every person gets a
// consistent, warm "portrait" derived from their name).
// ---------------------------------------------------------------------------

const GRADIENTS: [string, string, string][] = [
  ["#ff9a6b", "#e8553d", "#9c2d5a"], // sunset
  ["#f7a8c4", "#d63a6a", "#5b2150"], // rose
  ["#c7a5e8", "#7a4b9c", "#2f1c45"], // plum
  ["#ffc59a", "#f08a5d", "#b8475c"], // peach
  ["#9fd8d0", "#3d8c8f", "#1f3f55"], // lagoon
  ["#c9dca0", "#6c9a5b", "#2f5141"], // sage
  ["#ffd98a", "#e0a032", "#a2512d"], // amber
  ["#f3b0a0", "#c4566e", "#4a2a5e"], // berry
];

/** FNV-1a with a final mix, so similar names still spread across the palette. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

export function gradientFor(key: string) {
  return GRADIENTS[hash(key) % GRADIENTS.length];
}

export function Avatar({ name, size = 44, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const [a, b, c] = gradientFor(name);
  return (
    <div
      className="rounded-full flex items-center justify-center text-white shrink-0 display select-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${a}, ${b} 55%, ${c})`,
        fontSize: size * 0.5,
        lineHeight: 1,
        boxShadow: ring ? `0 0 0 3px var(--paper), 0 0 0 5px ${b}` : "inset 0 -6px 12px rgba(0,0,0,0.12)",
      }}
      aria-hidden
    >
      <span style={{ transform: "translateY(4%)" }}>{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

/** Large photo-style tile for profile cards. */
export function Portrait({
  name,
  className = "",
  children,
}: {
  name: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [a, b, c] = gradientFor(name);
  const h = hash(name);
  const x = 20 + (h % 60);
  const y = 15 + ((h >> 3) % 40);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at ${x}% ${y}%, ${a} 0%, ${b} 45%, ${c} 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          background: `radial-gradient(60% 50% at ${100 - x}% ${100 - y}%, rgba(255,255,255,0.9), transparent 70%)`,
        }}
      />
      <span
        className="display absolute text-white/25 select-none pointer-events-none leading-none"
        style={{ fontSize: "16rem", right: "-0.08em", bottom: "-0.28em" }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

const MONEY_LABEL = { saver: "Saver", balanced: "Balanced", spender: "Spender" } as const;
const INTENT_LABEL = { serious: "Something serious", casual: "Something casual", open: "Open to see" } as const;
export const moneyLabel = (s: keyof typeof MONEY_LABEL) => MONEY_LABEL[s];
export const intentLabel = (s: keyof typeof INTENT_LABEL) => INTENT_LABEL[s];

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider bg-plum-soft text-plum rounded-full px-2 py-0.5 ${className}`}>
      Demo profile
    </span>
  );
}

export function ProfileSummary({ p, compact = false }: { p: PublicProfile; compact?: boolean }) {
  return (
    <div className="flex gap-3.5 items-start">
      <Avatar name={p.name} size={compact ? 44 : 56} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`display leading-none ${compact ? "text-2xl" : "text-3xl"}`}>
            {p.name}
            <span className="text-muted">, {p.age}</span>
          </span>
          {p.isSeed && <DemoBadge />}
        </div>
        <div className="text-sm text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <Briefcase size={13} /> {p.occupation}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} /> {p.city}
          </span>
        </div>
        {!compact && <p className="mt-2.5 leading-relaxed">{p.bio}</p>}
        {!compact && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Tag tone="rose">{INTENT_LABEL[p.intent]}</Tag>
            <Tag tone="plum">
              <Coins size={12} /> {MONEY_LABEL[p.money.style]}
            </Tag>
            {p.interests.slice(0, 3).map((i) => (
              <Tag key={i}>{i}</Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "rose" | "plum" | "green" | "glass";
}) {
  const tones = {
    neutral: "bg-cream border border-line text-ink",
    rose: "bg-rose-soft text-rose",
    plum: "bg-plum-soft text-plum",
    green: "bg-green-soft text-green",
    glass: "bg-white/20 text-white backdrop-blur-md border border-white/25",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export const scoreColor = (v: number) => (v >= 70 ? "var(--green)" : v >= 50 ? "var(--amber)" : "var(--coral)");

export function ScoreRing({
  value,
  size = 64,
  stroke = 6,
  label,
  light = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  light?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = light ? "white" : scoreColor(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={light ? "rgba(255,255,255,0.25)" : "var(--line)"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${light ? "text-white" : ""}`}>
        <span className="font-semibold tabular-nums leading-none" style={{ fontSize: size * 0.3 }}>
          {value}
        </span>
        {label && (
          <span className="uppercase tracking-wider font-semibold mt-0.5 opacity-70" style={{ fontSize: Math.max(8, size * 0.11) }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums font-semibold" style={{ color: scoreColor(value) }}>
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-line/70 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, background: scoreColor(value) }}
        />
      </div>
    </div>
  );
}

export function VerdictCard({ v, title }: { v: Verdict; title: string }) {
  const yes = v.decision === "yes";
  return (
    <div className="card overflow-hidden rise">
      <div className={`px-5 sm:px-6 pt-5 pb-5 ${yes ? "bg-green-soft/60" : "bg-coral-soft/50"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
            <div className="display text-3xl leading-tight mt-1.5">{v.headline}</div>
            <span
              className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold rounded-full px-3 py-1 ${
                yes ? "bg-green text-white" : "bg-coral text-white"
              }`}
            >
              {yes ? <Heart size={12} filled /> : null}
              {yes ? "Wants to meet" : "Passing on this one"}
            </span>
          </div>
          <ScoreRing value={v.overall} size={78} stroke={7} label="fit" />
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
          <ScoreBar label="Chemistry" value={v.scores.chemistry} />
          <ScoreBar label="Values" value={v.scores.values} />
          <ScoreBar label="Lifestyle" value={v.scores.lifestyle} />
          <ScoreBar label="Money" value={v.scores.money} />
        </div>

        {(v.why.length > 0 || v.redFlags.length > 0) && (
          <ul className="space-y-2 text-sm">
            {v.why.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-green-soft text-green flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
            {v.redFlags.map((w, i) => (
              <li key={`r${i}`} className="flex gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-coral-soft text-coral flex items-center justify-center shrink-0">
                  <Flag size={11} strokeWidth={2.5} />
                </span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl bg-plum-soft p-4 text-sm leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-plum mb-1">
            <Coins size={15} /> The money talk
          </div>
          {v.moneyNotes}
        </div>

        {v.bestMoment && (
          <figure className="relative pl-9">
            <Quote size={22} className="absolute left-0 top-0 text-rose/40" />
            <blockquote className="display text-xl leading-snug">{v.bestMoment}</blockquote>
            <figcaption className="text-xs text-muted mt-1">Best moment of the date</figcaption>
          </figure>
        )}

        {v.noteToHuman && (
          <p className="text-sm leading-relaxed border-t border-line pt-4">
            <span className="font-semibold">Your agent says: </span>
            {v.noteToHuman}
          </p>
        )}
      </div>
    </div>
  );
}

export function Typing({ light = false }: { light?: boolean }) {
  const c = light ? "bg-white" : "bg-muted";
  return (
    <span className="inline-flex gap-1 items-center h-4" aria-label="typing">
      <span className={`dot w-1.5 h-1.5 rounded-full ${c}`} />
      <span className={`dot w-1.5 h-1.5 rounded-full ${c}`} />
      <span className={`dot w-1.5 h-1.5 rounded-full ${c}`} />
    </span>
  );
}

/** Two avatars overlapping with a heart between them. */
export function PairAvatars({ a, b, size = 40 }: { a: string; b: string; size?: number }) {
  return (
    <div className="flex items-center">
      <Avatar name={a} size={size} ring />
      <div
        className="-mx-2 z-10 rounded-full bg-paper flex items-center justify-center text-rose shadow-sm"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <Heart size={size * 0.3} filled />
      </div>
      <Avatar name={b} size={size} ring />
    </div>
  );
}

/** Floating hearts for celebratory moments. Purely decorative. */
export function HeartRain({ count = 16 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 37) % 100;
        const dur = 5 + ((i * 13) % 6);
        const delay = (i * 0.45) % 5;
        const size = 12 + ((i * 7) % 18);
        return (
          <span
            key={i}
            className="drift absolute text-white/70"
            style={{ left: `${left}%`, bottom: -40, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
          >
            <Heart size={size} filled />
          </span>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
