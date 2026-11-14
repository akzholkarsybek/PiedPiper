import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Page() {
  return (
    <>
      <header className="flow-nav">
        <Brand />
        <Link className="text-link" href="/discover">
          Back to introductions
        </Link>
      </header>
      <main id="main" className="reading-page">
        <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
        <h1>
          Why this person?
          <br />
          <em>You deserve to know.</em>
        </h1>
        <h2>First, both people get a say.</h2>
        <p>
          Before ranking anyone, we check both people’s age ranges, gender
          preferences, city preferences, relationship intentions, confirmed
          dealbreakers, profile approval, and blocks. A confirmed hard conflict
          excludes the introduction. Unknown information is clearly shown as a
          question; it is never treated as confirmed agreement.
        </p>
        <h2>Then, the common ground.</h2>
        <p>
          Eligible profiles are ranked using the same transparent, deterministic
          calculation every time. Gemini does not choose who passes the filters.
        </p>
        <table>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Default weight</th>
              <th>What it measures</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Relationship intention</td>
              <td>30</td>
              <td>The same approved relationship goal</td>
            </tr>
            <tr>
              <td>Lifestyle</td>
              <td>25</td>
              <td>Known answers meeting both people’s stated preferences</td>
            </tr>
            <tr>
              <td>Interests</td>
              <td>20</td>
              <td>Shared interests, divided by the larger set</td>
            </tr>
            <tr>
              <td>Values</td>
              <td>20</td>
              <td>Shared values, divided by the larger set</td>
            </tr>
            <tr>
              <td>Reciprocal preferences</td>
              <td>5</td>
              <td>How centrally each age fits the other’s range</td>
            </tr>
          </tbody>
        </table>
        <p>
          These weights produce an internal ordering, not a percentage chance of
          love. Feedback can raise the interest weight from 20 to 30 only when
          you choose to apply that change. Hard constraints always apply.
        </p>
        <h2>A missing answer is an invitation, not an assumption.</h2>
        <p>
          For family plans, smoking, drinking, and everyday pace, Piper
          identifies a missing answer only when it matters to the other person’s
          stated preferences. Hard requirements are prioritized. Answers update
          a profile only with consent, then the calculation runs again. A new
          hard conflict can remove an introduction.
        </p>
        <h2>AI, with a clear job.</h2>
        <p>
          Gemini conducts the interview, drafts a reviewable profile, and can
          phrase a relevant opt-in question. When highlighting an introduction,
          it can select only existing evidence facts. It cannot create new
          claims about a person or turn the ranking into a scientific
          prediction.
        </p>
        <Link className="button button-primary" href="/discover">
          Back to your introductions
        </Link>
      </main>
    </>
  );
}
