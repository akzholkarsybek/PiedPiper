import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Page() {
  return (
    <>
      <header className="flow-nav">
        <Brand />
        <Link className="text-link" href="/">
          Back home
        </Link>
      </header>
      <main id="main" className="reading-page">
        <span className="eyebrow">YOUR STORY. YOUR SAY.</span>
        <h1>
          Connection begins
          <br />
          with <em>trust.</em>
        </h1>
        <p>
          Pied Piper is a hackathon application for adults aged 18 and over. Its
          guest experience uses fictional profiles and original character
          illustrations. It does not predict romantic outcomes or provide
          scientifically validated compatibility scores.
        </p>
        <h2>The guest demonstration</h2>
        <p>
          Your approved fictional profile, decisions, messages, and feedback are
          saved in this browser’s local storage. They are not published to other
          users. Anyone using this browser profile may be able to see them. You
          can remove everything from <Link href="/profile">Your profile</Link>,
          or by clearing this site’s browser data.
        </p>
        <h2>When you talk to Piper</h2>
        <p>
          With your consent, fictional interview messages are sent through our
          server to Google’s Gemini API to generate a response and draft
          profile. We do not save interview transcripts in browser storage or
          the application database. Google’s processing and retention depend on
          the API account and terms configured by the operator. Use fictional
          information in this demo, and never submit sensitive personal
          information.
        </p>
        <p>
          The predefined demonstration runs without Gemini. It is always labeled
          as scripted. Server and hosting infrastructure may retain request
          metadata. The application does not deliberately log interview content
          or API keys.
        </p>
        <h2>Nothing shared by assumption</h2>
        <p>
          You review and approve your profile before matching. Unknown answers
          remain unknown. Optional investigation questions can be declined; a
          declined question is not asked again. Sharing an answer requires
          explicit consent. Your interview is never shown to a potential
          partner.
        </p>
        <h2>Boundaries are part of connection</h2>
        <p>
          Messaging opens only after mutual interest. In the guest demo, you
          explicitly simulate the fictional counterpart’s decision or reply. AI
          never sends a message pretending to be you. Blocking removes
          introductions and access to messaging. Guest reports are stored
          locally and are not delivered to a moderation team.
        </p>
        <h2>Real accounts</h2>
        <p>
          If the operator configures Supabase, real accounts use a separate
          authenticated database. Only approved profile details are discoverable
          to signed-in users. Access rules restrict messages to unblocked match
          participants, decisions to their owner, and compatibility answers to
          consented sharing. You can withdraw your profile and delete its
          associated application data from your account. Authentication identity
          deletion requires the operator or Supabase account tooling.
        </p>
        <h2>Before a public launch</h2>
        <p>
          This hackathon build uses an adults-only self-attestation, not
          identity or age verification. A public dating service needs stronger
          age verification, abuse prevention, staffed moderation, shared rate
          limiting, retention controls, verified provider agreements, and
          independent security testing. Reporting is not an emergency service.
          The operator must establish an actual response process before
          admitting real members.
        </p>
        <Link className="button button-primary" href="/onboarding?demo=1">
          Explore the fictional demo
        </Link>
      </main>
    </>
  );
}
