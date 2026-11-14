"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getMyId, setMyId } from "@/lib/client";
import type { Profile } from "@/lib/types";
import { Avatar, Portrait, Tag } from "@/components/ui";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { TypeCoach } from "@/components/TypeCoach";
import { ArrowLeft, ArrowRight, Briefcase, Coins, Heart, Lock, MapPin, Sparkle } from "@/components/icons";

type Form = {
  name: string;
  age: string;
  gender: "man" | "woman" | "nonbinary";
  lookingFor: "men" | "women" | "everyone";
  ageMin: string;
  ageMax: string;
  city: string;
  intent: "serious" | "casual" | "open";
  occupation: string;
  aboutMe: string;
  idealWeekend: string;
  humor: string;
  moneyHabits: string;
  dealbreakers: string;
  keepPrivate: string;
  /** Their type: who they'd like to meet, in their own words. Only their own agent sees it. */
  idealType: string;
  /** Optional photo, resized in the browser to a small JPEG data URL. */
  photo: string;
};

const EMPTY: Form = {
  name: "",
  age: "",
  gender: "woman",
  lookingFor: "men",
  ageMin: "25",
  ageMax: "40",
  city: "",
  intent: "serious",
  occupation: "",
  aboutMe: "",
  idealWeekend: "",
  humor: "",
  moneyHabits: "",
  dealbreakers: "",
  keepPrivate: "",
  idealType: "",
  photo: "",
};

const EXAMPLE: Form = {
  name: "Emma",
  age: "30",
  gender: "woman",
  lookingFor: "men",
  ageMin: "28",
  ageMax: "38",
  city: "Austin, TX",
  intent: "serious",
  occupation: "Data analyst at a healthcare company",
  aboutMe:
    "I'm the friend who plans the group trip and makes the shared Google Doc. I love trying new taco spots, I run half marathons badly, and I'm learning to make pottery that doesn't look like ashtrays.",
  idealWeekend: "Morning run, farmers market, cooking something ambitious, live music at night",
  humor: "Dry and sarcastic, I tease people I like. I hate small talk.",
  moneyHabits:
    "I budget everything and I'm saving for a house. I'm fine splitting the bill. I don't have debt except a car loan. Big spenders make me nervous.",
  dealbreakers: "Smoking, doesn't want kids, rude to waiters",
  keepPrivate: "I was engaged before and it ended badly, so don't bring up exes.",
  idealType: "Someone curious and a little nerdy who can laugh at themselves, is kind to strangers and actually makes plans.",
  photo: "",
};

const STEPS = [
  { title: "Say it all at once", sub: "Type or just talk about yourself in one go. Your agent fills in the form for you, and you check it. Or skip and fill it in yourself." },
  { title: "The basics", sub: "Who your agent is looking for, and where." },
  { title: "Who you are", sub: "Write like you talk. This becomes your agent's personality." },
  { title: "Money & privacy", sub: "The talk nobody has on date one, and what stays between you and your agent." },
  { title: "Your type", sub: "Who are you hoping to meet? Your agent uses this to judge every date. Only your agent sees it." },
];
const LAST = STEPS.length - 1;

/** Prefills the form when editing. Uses the saved answers; older profiles fall back to their generated persona. */
function formFromProfile(p: Profile): Form {
  const a = p.answers ?? {};
  const money = [p.money.splitBill, p.money.debtAttitude, p.money.goals].filter(Boolean).join(". ");
  return {
    name: p.name,
    age: String(p.age),
    gender: p.gender,
    lookingFor: p.lookingFor,
    ageMin: String(p.ageMin),
    ageMax: String(p.ageMax),
    city: p.city,
    intent: p.intent,
    occupation: p.occupation,
    aboutMe: a.aboutMe ?? p.bio,
    idealWeekend: a.idealWeekend ?? p.interests.join(", "),
    humor: a.humor ?? p.voice,
    moneyHabits: a.moneyHabits ?? money,
    dealbreakers: a.dealbreakers ?? p.dealbreakers.join(", "),
    keepPrivate: a.keepPrivate ?? p.privateNotes,
    idealType: p.idealType ?? "",
    photo: p.photo?.startsWith("data:") ? p.photo : "",
  };
}

/** What the dating coach may know about them: the answers so far, minus the photo, "keep private" notes and the draft itself. */
function coachProfile(f: Form): Record<string, string> {
  const skip = new Set<keyof Form>(["photo", "keepPrivate", "idealType"]);
  return Object.fromEntries(Object.entries(f).filter(([k]) => !skip.has(k as keyof Form)));
}

/** Fields the "say it all at once" step can fill (everything except the photo). */
type Answers = Partial<Omit<Record<keyof Form, string | number>, "photo">>;

const DUMP_EXAMPLE =
  "I'm Emma, 30, a data analyst in Austin. Looking for something serious with a guy around 28 to 38. Weekends are runs, farmers markets and live music. I budget everything and I'm saving for a house, happy to split the bill. Dealbreakers: smoking and being rude to waiters. My type is curious, a bit nerdy, and kind.";

function StartInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("edit") === "1";
  const inviteId = editing ? null : params.get("invite");
  const firstStep = editing ? 1 : 0; // editing starts at the form, not the "say it all at once" step
  const [step, setStep] = useState(firstStep);
  const [loading, setLoading] = useState(editing);
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviter, setInviter] = useState<Profile | null>(null);
  const [dump, setDump] = useState("");
  const [filled, setFilled] = useState<number | null>(null);

  useEffect(() => {
    if (!editing) return;
    const id = getMyId();
    if (!id) {
      router.replace("/start");
      return;
    }
    api<{ profile: Profile }>(`/api/profiles/${id}`)
      .then((r) => {
        setF(formFromProfile(r.profile));
      })
      .catch(() => setError("Couldn't load your profile. Try again."))
      .finally(() => setLoading(false));
  }, [editing, router]);

  useEffect(() => {
    if (!inviteId) return;
    api<{ profile: Profile }>(`/api/profiles/${inviteId}`)
      .then((r) => setInviter(r.profile))
      .catch(() => setInviter(null));
  }, [inviteId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  // Until the person edits "Their age range" themselves, keep it centred on their own age
  // (a fixed 25-40 default silently hid everyone younger than 25).
  const [rangeTouched, setRangeTouched] = useState(editing); // editing: keep their saved range
  function setAge(v: string) {
    const n = Number(v);
    setF((x) =>
      !rangeTouched && Number.isFinite(n) && n >= 18 && n <= 99
        ? { ...x, age: v, ageMin: String(Math.max(18, n - 5)), ageMax: String(Math.min(99, n + 8)) }
        : { ...x, age: v },
    );
  }

  async function fillFromDump() {
    setBusy(true);
    setError(null);
    try {
      const { answers } = await api<{ answers: Answers }>("/api/onboard/extract", { method: "POST", body: JSON.stringify({ text: dump }) });
      const keys = Object.keys(answers).filter((k) => k in EMPTY && k !== "photo") as (keyof Answers)[];
      const hasRange = answers.ageMin != null || answers.ageMax != null;
      if (hasRange) setRangeTouched(true);
      setF((x) => {
        const next = { ...x };
        for (const k of keys) (next as Record<string, string>)[k] = String(answers[k]);
        const n = Number(answers.age);
        if (!hasRange && !rangeTouched && n >= 18 && n <= 99) {
          next.ageMin = String(Math.max(18, n - 5));
          next.ageMax = String(Math.min(99, n + 8));
        }
        return next;
      });
      setFilled(keys.length);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const stepValid = [
    true,
    f.name.trim() && Number(f.age) >= 18 && f.city.trim() && f.occupation.trim(),
    f.aboutMe.trim().length >= 20 && f.idealWeekend.trim(),
    f.moneyHabits.trim().length >= 10,
    true,
  ];

  async function submit() {
    setBusy(true);
    setError(null);
    const answers = { ...f, age: Number(f.age), ageMin: Number(f.ageMin), ageMax: Number(f.ageMax) };
    if (editing) {
      try {
        await api<{ profile: Profile }>(`/api/profiles/${getMyId()}`, { method: "PUT", body: JSON.stringify(answers) });
        router.push("/me");
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
      return;
    }
    try {
      const { profile } = await api<{ profile: Profile }>("/api/profiles", {
        method: "POST",
        body: JSON.stringify(answers),
      });
      setMyId(profile.id);
      if (inviteId) {
        const { date } = await api<{ date: { id: string } }>("/api/dates", {
          method: "POST",
          body: JSON.stringify({ aId: profile.id, bId: inviteId }),
        });
        router.push(`/date/${date.id}`);
      } else {
        router.push("/me");
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 grid lg:grid-cols-[1fr_360px] gap-10 items-start">
      <div className="max-w-2xl w-full mx-auto lg:mx-0">
        {inviter && (
          <div className="card p-4 mb-6 flex items-center gap-3 bg-gradient-to-r from-rose-soft to-paper rise">
            <Avatar name={inviter.name} photo={inviter.photo} size={48} ring />
            <div className="min-w-0">
              <div className="font-semibold">{inviter.name} invited you on an agent date</div>
              <div className="text-sm text-muted">Finish your agent and the two of them meet right away.</div>
            </div>
          </div>
        )}

        {editing && (
          <div className="card p-4 mb-6 flex items-center gap-3 bg-gradient-to-r from-plum-soft to-paper rise">
            <Sparkle size={20} className="text-plum shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Editing your info</div>
              <div className="text-sm text-muted">Change anything, then save. Your agent is rebuilt from your new answers; your dates and matches stay.</div>
            </div>
          </div>
        )}

        {/* progress */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-ink">Step {step + 1}</span> of {STEPS.length}
          </div>
          <button className="text-sm font-medium text-rose hover:underline inline-flex items-center gap-1" onClick={() => (step === 0 ? setDump(DUMP_EXAMPLE) : setF(EXAMPLE))} type="button">
            <Sparkle size={14} /> Fill with an example
          </button>
        </div>
        <div className="flex gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-grad transition-all duration-500" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 space-y-4" aria-busy>
            <div className="h-14 w-2/3 rounded-2xl bg-line animate-pulse" />
            <div className="h-40 rounded-2xl bg-line animate-pulse" />
          </div>
        ) : (
        <div key={step} className="rise">
          <h1 className="display text-5xl sm:text-6xl mt-8 leading-none">{STEPS[step].title}</h1>
          <p className="text-muted mt-3">{STEPS[step].sub}</p>

          <div className="mt-8 space-y-7">
            {step === 0 && (
              <>
                <Field
                  label="Tell your agent about you"
                  hint="Your name, age, city and job, who you want to meet, your weekends, how you handle money, dealbreakers, your type… Anything you skip, you can fill in next."
                >
                  <VoiceTextarea
                    className="input min-h-56"
                    value={dump}
                    onValueChange={setDump}
                    placeholder={DUMP_EXAMPLE}
                    maxLength={4000}
                    autoFocus
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                {filled !== null && (
                  <div className="rounded-2xl bg-rose-soft px-4 py-3 text-sm flex items-center gap-2">
                    <Sparkle size={15} className="text-rose shrink-0" />
                    {filled > 0
                      ? `Your agent filled in ${filled} answer${filled === 1 ? "" : "s"} from what you said. Check them and fill in the blanks.`
                      : "Your agent couldn't pick out any answers. Fill them in here, it only takes a minute."}
                  </div>
                )}
                <div className="grid grid-cols-[1fr_110px] gap-4">
                  <Field label="First name">
                    <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Emma" autoFocus={!f.name} />
                  </Field>
                  <Field label="Age">
                    <input className="input" type="number" inputMode="numeric" min={18} value={f.age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
                  </Field>
                </div>

                <Choice
                  label="I am"
                  value={f.gender}
                  onChange={(v) => set("gender", v)}
                  options={[
                    ["woman", "A woman"],
                    ["man", "A man"],
                    ["nonbinary", "Nonbinary"],
                  ]}
                />
                <Choice
                  label="Interested in"
                  value={f.lookingFor}
                  onChange={(v) => set("lookingFor", v)}
                  options={[
                    ["men", "Men"],
                    ["women", "Women"],
                    ["everyone", "Everyone"],
                  ]}
                />
                <Choice
                  label="Looking for"
                  value={f.intent}
                  onChange={(v) => set("intent", v)}
                  options={[
                    ["serious", "💍 Something serious"],
                    ["casual", "🍸 Something casual"],
                    ["open", "✨ Open to see"],
                  ]}
                />

                <Field label="Their age range">
                  <div className="flex items-center gap-3 max-w-xs">
                    <input className="input text-center" type="number" inputMode="numeric" value={f.ageMin} onChange={(e) => (setRangeTouched(true), set("ageMin", e.target.value))} aria-label="Minimum age" />
                    <span className="text-muted">to</span>
                    <input className="input text-center" type="number" inputMode="numeric" value={f.ageMax} onChange={(e) => (setRangeTouched(true), set("ageMax", e.target.value))} aria-label="Maximum age" />
                  </div>
                </Field>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="City">
                    <input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Austin, TX" />
                  </Field>
                  <Field label="What you do">
                    <input className="input" value={f.occupation} onChange={(e) => set("occupation", e.target.value)} placeholder="Nurse, teacher, engineer…" />
                  </Field>
                </div>

                <PhotoPicker value={f.photo} onChange={(v) => set("photo", v)} />
              </>
            )}

            {step === 2 && (
              <>
                <Field
                  label="Tell your agent about you"
                  hint={f.aboutMe.trim().length < 20 ? `A couple of sentences at least (${f.aboutMe.trim().length}/20)` : "Nice. The more you, the better it represents you."}
                >
                  <VoiceTextarea
                    className="input min-h-36"
                    value={f.aboutMe}
                    onValueChange={(v) => set("aboutMe", v)}
                    placeholder="I'm the friend who plans the group trip… I can't resist a new taco spot…"
                    maxLength={600}
                    autoFocus
                  />
                </Field>
                <Field label="Your ideal weekend">
                  <VoiceTextarea
                    className="input min-h-24"
                    value={f.idealWeekend}
                    onValueChange={(v) => set("idealWeekend", v)}
                    placeholder="Morning run, farmers market, live music at night"
                    maxLength={600}
                  />
                </Field>
                <Field label="Your sense of humor" hint="e.g. dry, goofy, sarcastic, dad jokes">
                  <input className="input" value={f.humor} onChange={(e) => set("humor", e.target.value)} placeholder="Dry and sarcastic, I tease people I like" />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field
                  label="How do you handle money?"
                  hint="Saver or spender? Split the bill? Any debt you're working on? What are you saving for?"
                  icon={<Coins size={16} className="text-plum" />}
                >
                  <VoiceTextarea
                    className="input min-h-32"
                    value={f.moneyHabits}
                    onValueChange={(v) => set("moneyHabits", v)}
                    placeholder="I budget, I'm saving for a house, happy to split the bill…"
                    maxLength={600}
                    autoFocus
                  />
                </Field>
                <Field label="Dealbreakers" icon={<span aria-hidden>🚩</span>}>
                  <input className="input" value={f.dealbreakers} onChange={(e) => set("dealbreakers", e.target.value)} placeholder="Smoking, doesn't want kids…" maxLength={400} />
                </Field>
                <div className="rounded-3xl bg-plum-soft p-5">
                  <Field
                    label="Keep private"
                    hint="Your agent knows this but will never bring it up on a first date."
                    icon={<Lock size={16} className="text-plum" />}
                  >
                    <VoiceTextarea
                      className="input min-h-20 bg-paper"
                      value={f.keepPrivate}
                      onValueChange={(v) => set("keepPrivate", v)}
                      placeholder="Optional"
                      maxLength={400}
                    />
                  </Field>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="What's your type?" hint="Personality, values, lifestyle, looks, energy… whatever matters to you. Optional, but it helps your agent say yes to the right people.">
                  <VoiceTextarea
                    className="input min-h-36"
                    value={f.idealType}
                    onValueChange={(v) => set("idealType", v)}
                    placeholder="Someone curious who can laugh at themselves, kind to strangers, and actually makes plans…"
                    maxLength={400}
                    autoFocus
                  />
                </Field>
                <TypeCoach profile={coachProfile(f)} draft={f.idealType} onUse={(t) => set("idealType", t)} />
              </>
            )}
          </div>
        </div>

        )}

        {error && <p className="text-sm text-coral mt-5">{error}</p>}

        <div className="flex items-center justify-between gap-3 mt-10 pt-6 border-t border-line">
          <button className="btn btn-ghost" disabled={step === firstStep || busy || loading} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft size={16} /> Back
          </button>
          {step === 0 ? (
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost" disabled={busy} onClick={() => (setError(null), setStep(1))}>
                Skip
              </button>
              <button className="btn btn-primary px-7" disabled={dump.trim().length < 10 || busy} onClick={fillFromDump}>
                <Sparkle size={16} /> {busy ? "Reading…" : "Fill my answers"}
              </button>
            </div>
          ) : step < LAST ? (
            <div className="flex items-center gap-2">
              {editing && (
                <button className="btn btn-ghost" disabled={!stepValid.every(Boolean) || busy || loading} onClick={submit}>
                  Save now
                </button>
              )}
              <button className="btn btn-primary px-7" disabled={!stepValid[step] || loading} onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-grad px-7" disabled={!stepValid.every(Boolean) || busy} onClick={submit}>
              <Heart size={16} filled />
              {editing ? "Save changes" : inviteId ? "Create agent & start the date" : "Create my agent"}
            </button>
          )}
        </div>
      </div>

      <aside className="hidden lg:block sticky top-24">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Your card, as others see it</div>
        <PreviewCard f={f} />
        <p className="hint mt-3 leading-relaxed">
          Your agent writes your bio and voice from your answers. It never invents facts about you.
        </p>
      </aside>

      {busy && (step === LAST || editing) && <TrainingOverlay name={f.name} updating={editing} />}
    </div>
  );
}

function PreviewCard({ f }: { f: Form }) {
  const name = f.name.trim() || "You";
  const intent = { serious: "Something serious", casual: "Something casual", open: "Open to see" }[f.intent];
  const interests = f.idealWeekend
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);
  return (
    <div className="card overflow-hidden shadow-md">
      <Portrait name={name} photo={f.photo || null} className="h-80">
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="display text-4xl leading-none">
            {name}
            {f.age && <span className="opacity-80">, {f.age}</span>}
          </div>
          <div className="text-sm text-white/85 mt-2 space-y-0.5">
            {f.occupation && (
              <div className="flex items-center gap-1.5">
                <Briefcase size={13} /> {f.occupation}
              </div>
            )}
            {f.city && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} /> {f.city}
              </div>
            )}
          </div>
        </div>
      </Portrait>
      <div className="p-5">
        <p className={`text-sm leading-relaxed line-clamp-3 ${f.aboutMe ? "" : "text-muted italic"}`}>
          {f.aboutMe || "Your agent will write a witty one-line bio from your answers."}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Tag tone="rose">{intent}</Tag>
          {interests.map((i) => (
            <Tag key={i}>{i}</Tag>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrainingOverlay({ name, updating }: { name: string; updating?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 glass flex items-center justify-center p-6 fade-in">
      <div className="text-center max-w-sm">
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-grad opacity-30 blur-xl heartbeat" />
          <div className="relative w-28 h-28 rounded-full bg-grad text-white flex items-center justify-center shadow-lg heartbeat">
            <Heart size={44} filled />
          </div>
        </div>
        <h2 className="display text-4xl mt-8">
          {updating ? "Updating" : "Training"} {name.trim() ? `${name.trim()}'s` : "your"} agent
        </h2>
        <p className="text-muted mt-2">Learning your voice, your values and your money style…</p>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shrinks a picked image to a square JPEG (about 20-40 KB) so it can be stored with the profile. */
async function toSmallJpeg(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    // centre crop to a square
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [err, setErr] = useState<string | null>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("image/")) return setErr("Please pick an image file.");
    try {
      onChange(await toSmallJpeg(file));
    } catch {
      setErr("Couldn't read that image. Try a JPG or PNG.");
    }
  }
  return (
    <div>
      <span className="label">
        Photo <span className="font-normal text-muted">(optional)</span>
      </span>
      <div className="flex items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={value} alt="Your photo" className="w-16 h-16 rounded-full object-cover border border-line" />
        ) : (
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-line flex items-center justify-center text-muted text-2xl" aria-hidden>
            +
          </div>
        )}
        <label className="btn btn-ghost text-sm py-2 cursor-pointer">
          {value ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={pick} />
        </label>
        {value && (
          <button type="button" className="text-sm text-muted hover:text-coral" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {err ? <span className="hint block mt-1.5 text-coral">{err}</span> : <span className="hint block mt-1.5">Shown to people your agent dates. Only a small copy is saved.</span>}
    </div>
  );
}

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
      {hint && <span className="hint block mt-1.5">{hint}</span>}
    </label>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <StartInner />
    </Suspense>
  );
}
