"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, getMyId, setMyId } from "@/lib/client";
import type { Profile, Verdict } from "@/lib/types";
import { VENUES, venueOf, type VenueId } from "@/lib/venues";
import { Avatar, DemoBadge, Portrait, ScoreRing, Skeleton, Tag, intentLabel, moneyLabel } from "@/components/ui";
import { ArrowRight, Briefcase, Check, Coins, Heart, LinkIcon, Lock, MapPin, Message, Sparkle } from "@/components/icons";

type Candidate = { profile: Profile; score: number; reasons: string[] };
type DateItem = {
  id: string;
  status: string;
  venue?: string;
  chemistry?: number | null;
  other: Profile | null;
  myVerdict: Verdict | null;
  mutual: boolean;
  matchId: string | null;
};

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [dates, setDates] = useState<DateItem[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueId>("cafe");

  const load = useCallback(
    async (id: string) => {
      try {
        const [p, c, d] = await Promise.all([
          api<{ profile: Profile }>(`/api/profiles/${id}`),
          api<{ candidates: Candidate[] }>(`/api/profiles/${id}/candidates`),
          api<{ dates: DateItem[] }>(`/api/profiles/${id}/dates`),
        ]);
        setMe(p.profile);
        setCands(c.candidates);
        setDates(d.dates);
      } catch {
        // Profile was lost (e.g. server restarted in memory mode) — start over.
        setMyId(null);
        router.replace("/start");
      }
    },
    [router],
  );

  useEffect(() => {
    // cacheComponents keeps this page's state when you navigate away and back. Clear the
    // "sending your agent…" state from last time (otherwise every Send button stays disabled)
    // and reload, so new dates and matches show up without a page refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting stale state when the page is shown again
    setStarting(null);
    const id = getMyId();
    if (!id) router.replace("/start");
    else load(id);
  }, [load, router]);

  async function startDate(otherId: string) {
    if (!me) return;
    setStarting(otherId);
    setError(null);
    try {
      const { date } = await api<{ date: { id: string } }>("/api/dates", {
        method: "POST",
        body: JSON.stringify({ aId: me.id, bId: otherId, venue }),
      });
      router.push(`/date/${date.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  function copyInvite() {
    if (!me) return;
    navigator.clipboard.writeText(`${location.origin}/start?invite=${me.id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!me) return <LoadingState />;

  const matches = dates.filter((d) => d.mutual && d.matchId && d.other);
  const [top, ...rest] = cands;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div>
          <p className="text-sm text-muted">Your agent is ready</p>
          <h1 className="display text-5xl sm:text-6xl leading-none mt-1">Hi, {me.name}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Stat value={dates.length} label="agent dates" />
          <Stat value={matches.length} label="matches" accent />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 mt-8 items-start">
        <section className="space-y-10 min-w-0">
          {/* matches row */}
          {matches.length > 0 && (
            <div className="rise">
              <SectionTitle icon={<Heart size={16} filled />} title="Your matches" sub="Both agents said yes. Say hi." />
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 mt-4">
                {matches.map((d) => (
                  <Link key={d.id} href={`/match/${d.matchId}`} className="flex flex-col items-center gap-2 shrink-0 group w-20">
                    <div className="rounded-full p-[3px] bg-grad group-hover:scale-105 transition-transform">
                      <div className="rounded-full p-[2px] bg-paper">
                        <Avatar name={d.other!.name} photo={d.other!.photo} size={64} />
                      </div>
                    </div>
                    <span className="text-sm font-medium truncate max-w-full">{d.other!.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* lineup */}
          <div>
            <SectionTitle
              icon={<Sparkle size={16} />}
              title="Tonight's lineup"
              sub="Pre-screened on preferences, intent, values and money style. Send your agent to find out the rest."
            />
            {error && <p className="text-sm text-coral mt-3">{error}</p>}

            {cands.length > 0 && (
              <div className="mt-5">
                <div className="text-sm font-medium">Where should the date be?</div>
                <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label="Date location">
                  {VENUES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={venue === v.id}
                      onClick={() => setVenue(v.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        venue === v.id
                          ? "bg-plum text-white border-plum"
                          : "bg-paper border-line text-ink hover:bg-cream"
                      }`}
                    >
                      <span aria-hidden>{v.emoji}</span> {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cands.length === 0 ? (
              <div className="card p-8 text-center mt-5">
                <div className="w-14 h-14 rounded-full bg-rose-soft text-rose flex items-center justify-center mx-auto">
                  <Heart size={24} />
                </div>
                <div className="display text-3xl mt-4">You&apos;ve met everyone for now</div>
                <p className="text-muted mt-2 max-w-sm mx-auto">
                  No new people fit your preferences right now. Invite someone real and your agents will meet right away.
                </p>
                <button className="btn btn-grad mt-5" onClick={copyInvite}>
                  <LinkIcon size={16} /> {copied ? "Link copied" : "Copy invite link"}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {top && <FeaturedCard c={top} busy={starting} onSend={startDate} />}
                {rest.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {rest.map((c, i) => (
                      <CandidateCard key={c.profile.id} c={c} busy={starting} onSend={startDate} delay={i * 0.06} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* history */}
          {dates.length > 0 && (
            <div>
              <SectionTitle icon={<Message size={16} />} title="Agent dates" sub="Everything your agent has been up to." />
              <div className="card divide-y divide-line mt-4 overflow-hidden">
                {dates.map((d) =>
                  d.other ? (
                    <Link
                      key={d.id}
                      href={d.matchId ? `/match/${d.matchId}` : `/date/${d.id}`}
                      className="flex items-center gap-3.5 p-4 hover:bg-cream transition-colors"
                    >
                      <Avatar name={d.other.name} photo={d.other.photo} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center gap-2">
                          {d.other.name}
                          {d.other.isSeed && <DemoBadge />}
                          <span className="text-xs font-normal text-muted" title={`Date at: ${venueOf(d.venue).label}`}>
                            {venueOf(d.venue).emoji}
                            {d.chemistry != null && ` · chemistry ${d.chemistry}`}
                          </span>
                        </div>
                        <div className="text-sm text-muted truncate">
                          {d.myVerdict
                            ? d.myVerdict.headline
                            : d.status === "done"
                              ? "Waiting for verdict"
                              : d.status === "running"
                                ? "On a date right now…"
                                : "Not finished yet. Tap to run it."}
                        </div>
                      </div>
                      {d.myVerdict && <ScoreRing value={d.myVerdict.overall} size={40} stroke={4} />}
                      {d.mutual ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-grad text-white px-2.5 py-1 font-semibold">
                          <Heart size={11} filled /> Match
                        </span>
                      ) : d.myVerdict ? (
                        <span className="text-xs rounded-full bg-cream border border-line px-2.5 py-1 text-muted">
                          {d.myVerdict.decision === "yes" ? "You: yes" : "Pass"}
                        </span>
                      ) : (
                        <ArrowRight size={16} className="text-muted" />
                      )}
                    </Link>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </section>

        {/* sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card overflow-hidden">
            <Portrait name={me.name} photo={me.photo} className="h-40">
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-white/80">Your agent represents</div>
                <div className="display text-3xl leading-none mt-1">
                  {me.name}, {me.age}
                </div>
              </div>
            </Portrait>
            <div className="p-5 space-y-4 text-sm">
              <p className="leading-relaxed">{me.bio}</p>
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="rose">{intentLabel(me.intent)}</Tag>
                <Tag tone="plum">
                  <Coins size={12} /> {moneyLabel(me.money.style)}
                </Tag>
                {me.interests.slice(0, 4).map((i) => (
                  <Tag key={i}>{i}</Tag>
                ))}
              </div>
              <Detail label="Voice">{me.voice}</Detail>
              <Detail label="Money">{me.money.splitBill}</Detail>
              {me.dealbreakers.length > 0 && <Detail label="Dealbreakers">{me.dealbreakers.join(" · ")}</Detail>}
              {me.privateNotes && (
                <div className="rounded-2xl bg-plum-soft p-3.5 text-plum">
                  <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider">
                    <Lock size={13} /> Never brings up
                  </div>
                  <div className="mt-1">{me.privateNotes}</div>
                </div>
              )}
              <Link href="/start?edit=1" className="btn btn-ghost w-full text-sm py-2.5">
                <Sparkle size={15} /> Edit my info
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] bg-grad p-5 text-white shadow-md relative overflow-hidden">
            <Heart size={120} filled className="absolute -right-6 -bottom-8 text-white/10" />
            <div className="font-semibold text-lg relative">Invite someone real</div>
            <p className="text-sm text-white/85 mt-1 relative">
              Send this link to a friend or crush. When they make an agent, your agents go on a date right away.
            </p>
            <button className="btn w-full mt-4 bg-white text-plum hover:bg-cream relative" onClick={copyInvite}>
              {copied ? (
                <>
                  <Check size={16} /> Link copied
                </>
              ) : (
                <>
                  <LinkIcon size={16} /> Copy invite link
                </>
              )}
            </button>
            <p className="text-xs text-white/75 mt-2.5 relative">Testing alone? Open the link in an incognito window.</p>
          </div>

          <button
            className="text-sm text-muted hover:text-ink underline underline-offset-4 px-1"
            onClick={() => {
              setMyId(null);
              router.push("/start");
            }}
          >
            Start over with a new profile
          </button>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type CardProps = { c: Candidate; busy: string | null; onSend: (id: string) => void };

function SendButton({ c, busy, onSend, className = "" }: CardProps & { className?: string }) {
  const mine = busy === c.profile.id;
  return (
    <button className={`btn btn-grad ${className}`} disabled={!!busy} onClick={() => onSend(c.profile.id)}>
      {mine ? (
        "Seating your agents…"
      ) : (
        <>
          <Heart size={16} filled /> Send my agent
        </>
      )}
    </button>
  );
}

function FeaturedCard({ c, busy, onSend }: CardProps) {
  const p = c.profile;
  return (
    <div className="card overflow-hidden grid md:grid-cols-[300px_1fr] rise card-lift">
      <Portrait name={p.name} photo={p.photo} className="h-72 md:h-full min-h-72">
        <span className="absolute top-4 left-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-white/90 text-rose px-2.5 py-1">
          <Sparkle size={12} /> Top pick
        </span>
        <div className="absolute top-3 right-3 rounded-full bg-black/15 backdrop-blur-md p-1">
          <ScoreRing value={c.score} size={56} stroke={5} light label="fit" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="display text-5xl leading-none">
            {p.name}
            <span className="opacity-80">, {p.age}</span>
          </div>
          <div className="text-sm text-white/90 mt-2 flex flex-wrap gap-x-3">
            <span className="inline-flex items-center gap-1">
              <Briefcase size={13} /> {p.occupation}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {p.city}
            </span>
          </div>
        </div>
      </Portrait>
      <div className="p-6 flex flex-col">
        {p.isSeed && <DemoBadge className="self-start mb-3" />}
        <p className="display text-2xl leading-snug">“{p.bio}”</p>
        <div className="flex flex-wrap gap-1.5 mt-4">
          <Tag tone="rose">{intentLabel(p.intent)}</Tag>
          <Tag tone="plum">
            <Coins size={12} /> {moneyLabel(p.money.style)}
          </Tag>
          {p.interests.slice(0, 4).map((i) => (
            <Tag key={i}>{i}</Tag>
          ))}
        </div>
        {c.reasons.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Why you might click</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {c.reasons.map((r) => (
                <li key={r} className="flex gap-2 items-start">
                  <Check size={15} className="text-green mt-0.5 shrink-0" strokeWidth={2.5} /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto pt-6">
          <SendButton c={c} busy={busy} onSend={onSend} className="w-full sm:w-auto px-8" />
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ c, busy, onSend, delay }: CardProps & { delay: number }) {
  const p = c.profile;
  return (
    <div className="card overflow-hidden flex flex-col rise card-lift" style={{ animationDelay: `${delay}s` }}>
      <Portrait name={p.name} photo={p.photo} className="h-60">
        <div className="absolute top-3 right-3 rounded-full bg-black/15 backdrop-blur-md p-1">
          <ScoreRing value={c.score} size={46} stroke={4} light />
        </div>
        {p.isSeed && (
          <span className="absolute top-4 left-4 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-white/85 text-plum px-2 py-0.5">
            Demo
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="display text-4xl leading-none">
            {p.name}
            <span className="opacity-80">, {p.age}</span>
          </div>
          <div className="text-[13px] text-white/90 mt-1.5 flex items-center gap-1 truncate">
            <Briefcase size={12} /> <span className="truncate">{p.occupation}</span>
          </div>
        </div>
      </Portrait>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-muted flex items-center gap-1">
          <MapPin size={12} /> {p.city}
        </div>
        <p className="text-sm leading-relaxed mt-2 line-clamp-2">{p.bio}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Tag tone="plum">
            <Coins size={12} /> {moneyLabel(p.money.style)}
          </Tag>
          {p.interests.slice(0, 2).map((i) => (
            <Tag key={i}>{i}</Tag>
          ))}
        </div>
        {c.reasons[0] && (
          <p className="text-xs text-muted mt-3 flex gap-1.5 items-start">
            <Sparkle size={12} className="text-rose mt-0.5 shrink-0" /> {c.reasons[0]}
          </p>
        )}
        <div className="mt-auto pt-4">
          <SendButton c={c} busy={busy} onSend={onSend} className="w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div>
      <h2 className="display text-4xl leading-none flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-rose-soft text-rose flex items-center justify-center shrink-0">{icon}</span>
        {title}
      </h2>
      {sub && <p className="text-muted text-sm mt-2">{sub}</p>}
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-2.5 ${accent ? "bg-grad text-white shadow-md" : "card"}`}>
      <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
      <div className={`text-xs mt-1 ${accent ? "text-white/85" : "text-muted"}`}>{label}</div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 leading-relaxed">{children}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-64 mt-3" />
      <div className="grid lg:grid-cols-[1fr_340px] gap-8 mt-8">
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-[24px]" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-80 rounded-[24px]" />
            <Skeleton className="h-80 rounded-[24px]" />
          </div>
        </div>
        <Skeleton className="h-96 rounded-[24px]" />
      </div>
    </div>
  );
}
