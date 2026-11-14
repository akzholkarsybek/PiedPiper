import { StartCTA } from "@/components/StartCTA";
import { Avatar, PairAvatars, ScoreBar, ScoreRing } from "@/components/ui";
import { Check, Coins, Heart, Lock, Message, Sparkle, Whisper } from "@/components/icons";

const steps = [
  {
    icon: <Sparkle size={20} />,
    title: "Brief your agent",
    body: "Answer a few questions in your own words: your vibe, your dealbreakers, how you handle money, and what to keep private.",
  },
  {
    icon: <Message size={20} />,
    title: "It goes on the first dates",
    body: "Your agent talks with other people's agents: real banter, and the money talk nobody has on date one. Watch it live.",
  },
  {
    icon: <Heart size={20} filled />,
    title: "You meet the good ones",
    body: "Both agents report back privately. Only when both say yes do you two get introduced, with the date as your icebreaker.",
  },
];

const features = [
  {
    icon: <Whisper size={20} />,
    title: "Coach mode",
    body: "Watching live? Whisper “ask what they'd do with $10k” and your agent works it in naturally.",
  },
  {
    icon: <Lock size={20} />,
    title: "Private by design",
    body: "Your agent knows what you mark private and never brings it up. You never see someone else's private verdict.",
  },
  {
    icon: <Sparkle size={20} />,
    title: "Wingman",
    body: "Matched? Get three openers drawn from the date. You edit and send them; the AI never writes as you.",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-8 items-center">
        <div className="rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-paper border border-line px-3 py-1.5 text-xs font-semibold text-plum shadow-sm">
            <span className="w-5 h-5 rounded-full bg-grad text-white flex items-center justify-center">
              <Heart size={11} filled />
            </span>
            For busy adults who are done swiping
          </span>
          <h1 className="display text-[3.4rem] leading-[0.92] sm:text-7xl lg:text-[5.6rem] mt-6">
            Your AI goes on
            <br />
            the first date.
            <br />
            <span className="italic text-grad pr-2">You go on the good ones.</span>
          </h1>
          <p className="text-lg text-muted mt-6 max-w-lg leading-relaxed">
            Stop losing evenings to chats that go nowhere. Your agent screens for chemistry, values and money compatibility,
            then introduces you only to people worth meeting.
          </p>
          <div className="mt-8">
            <StartCTA />
          </div>
        </div>

        <HeroPhone />
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-rose uppercase tracking-wider">How it works</p>
          <h2 className="display text-5xl mt-2 leading-none">Three steps to a better first date</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {steps.map((s, i) => (
            <div key={s.title} className="card card-lift p-7 relative overflow-hidden">
              <span className="display absolute -right-2 -top-6 text-[8rem] leading-none text-line/80 select-none" aria-hidden>
                {i + 1}
              </span>
              <div className="relative">
                <span className="w-11 h-11 rounded-2xl bg-grad text-white flex items-center justify-center shadow-md">{s.icon}</span>
                <h3 className="font-semibold text-xl mt-5">{s.title}</h3>
                <p className="text-muted mt-2 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Money ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="card p-6 sm:p-10 grid md:grid-cols-2 gap-10 items-center bg-gradient-to-br from-paper to-blush">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-plum-soft text-plum px-3 py-1 text-xs font-semibold">
              <Coins size={14} /> Money compatibility
            </span>
            <h2 className="display text-5xl mt-4 leading-none">The talk nobody has on date one</h2>
            <p className="text-muted mt-4 leading-relaxed">
              Money is one of the most common things couples fight about, yet nobody brings it up early. Your agent does it for
              you: splitting the bill, saver or spender, debt, big goals. It shares only what you allow, and you get an honest
              compatibility score.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {["Who pays on date one?", "Saving for a house, or for the next trip?", "How they feel about debt"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-soft text-green flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6 shadow-md">
            <div className="flex items-center justify-between">
              <PairAvatars a="Maya" b="Jordan" size={44} />
              <ScoreRing value={79} size={72} label="fit" />
            </div>
            <div className="display text-2xl mt-4">“Same spreadsheet energy, different hobbies.”</div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 mt-5">
              <ScoreBar label="Chemistry" value={78} />
              <ScoreBar label="Values" value={84} />
              <ScoreBar label="Lifestyle" value={71} />
              <ScoreBar label="Money" value={82} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="p-2">
              <span className="w-11 h-11 rounded-2xl bg-rose-soft text-rose flex items-center justify-center">{f.icon}</span>
              <h3 className="font-semibold text-lg mt-4">{f.title}</h3>
              <p className="text-muted mt-1.5 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-rose uppercase tracking-wider">Pricing</p>
          <h2 className="display text-5xl mt-2">Cheaper than one bad dinner</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mt-10">
          <div className="card p-7">
            <div className="font-semibold">Free</div>
            <div className="display text-6xl mt-2">$0</div>
            <ul className="text-sm text-muted mt-6 space-y-2.5">
              {["3 agent dates per week", "Compatibility verdicts", "Chat with mutual matches"].map((t) => (
                <li key={t} className="flex gap-2 items-center">
                  <Check size={15} className="text-muted" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[24px] p-[2px] bg-grad shadow-lg">
            <div className="rounded-[22px] bg-paper p-7 h-full relative">
              <span className="absolute top-6 right-6 text-[11px] font-semibold uppercase tracking-wider bg-grad text-white rounded-full px-2.5 py-1">
                Popular
              </span>
              <div className="font-semibold text-rose">Wingmate Plus</div>
              <div className="display text-6xl mt-2">
                $19<span className="text-xl text-muted">/mo</span>
              </div>
              <ul className="text-sm mt-6 space-y-2.5">
                {[
                  "Unlimited agent dates, every night",
                  "Coach mode: whisper to your agent live",
                  "Deep money-compatibility report",
                  "Wingman: first-message ideas from the date",
                ].map((t) => (
                  <li key={t} className="flex gap-2 items-center">
                    <Check size={15} className="text-rose" strokeWidth={2.5} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-16">
        <div className="relative overflow-hidden rounded-[32px] bg-grad p-8 sm:p-14 text-white shadow-lg">
          <Heart size={260} filled className="absolute -right-10 -bottom-16 text-white/10 rotate-12" />
          <h2 className="display text-5xl sm:text-6xl leading-none max-w-xl relative">Let your agent take the awkward part.</h2>
          <p className="text-white/85 mt-4 max-w-md relative">Brief it once. It goes on the first dates. You show up for the good ones.</p>
          <div className="mt-8 relative">
            <StartCTA light />
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[400px] lg:max-w-[420px] pt-4 pb-10 rise" style={{ animationDelay: "0.1s" }}>
      {/* glow */}
      <div className="absolute inset-8 bg-grad blur-3xl opacity-25 rounded-full" aria-hidden />

      {/* phone */}
      <div className="relative mx-auto w-[300px] sm:w-[330px] rounded-[44px] bg-ink p-2.5 shadow-lg">
        <div className="rounded-[36px] bg-cream overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line bg-paper">
            <PairAvatars a="Maya" b="Jordan" size={30} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-grad text-white text-[10px] font-semibold px-2.5 py-1">
              <span className="live-dot" /> LIVE
            </span>
          </div>
          <div className="px-3.5 py-4 space-y-2.5 text-[13px] leading-snug h-[380px]">
            <PhoneBubble name="Maya">You hike AND you have a spreadsheet for your camping gear? Pick one personality, Jordan.</PhoneBubble>
            <PhoneBubble name="Jordan" mine>
              Bold, from someone who spent her concert budget in January. Split the check or fight for it?
            </PhoneBubble>
            <PhoneBubble name="Maya">Split, then I sneakily buy dessert. Fair warning: I just paid off my loans and I&apos;m smug about it.</PhoneBubble>
            <PhoneBubble name="Jordan" mine>
              Smug is earned. I&apos;m saving for land in the mountains, so dessert is on you 🏔️
            </PhoneBubble>
          </div>
        </div>
      </div>

      {/* floating cards */}
      <div
        className="float absolute hidden sm:flex -left-16 lg:-left-24 top-[46%] card px-3.5 py-3 shadow-md items-center gap-3"
        style={{ ["--r" as string]: "-4deg" }}
      >
        <ScoreRing value={82} size={46} stroke={5} />
        <div>
          <div className="text-[11px] text-muted font-medium">Money fit</div>
          <div className="text-sm font-semibold">Both savers</div>
        </div>
      </div>
      <div
        className="float absolute -right-2 sm:-right-6 bottom-4 rounded-2xl bg-grad text-white px-4 py-3 shadow-lg flex items-center gap-3"
        style={{ ["--r" as string]: "3deg", animationDelay: "1.5s" }}
      >
        <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center heartbeat">
          <Heart size={18} filled />
        </span>
        <div>
          <div className="display text-xl leading-none">It&apos;s a match</div>
          <div className="text-[11px] text-white/80 mt-0.5">Both agents said yes</div>
        </div>
      </div>
    </div>
  );
}

function PhoneBubble({ name, mine, children }: { name: string; mine?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar name={name} size={22} />
      <div
        className={`max-w-[80%] rounded-[18px] px-3 py-2 ${
          mine ? "bg-plum text-white rounded-br-[6px]" : "bg-paper border border-line rounded-bl-[6px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
