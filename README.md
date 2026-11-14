# Pied Piper

**Your AI finds the people. You build the relationship.**

A conversation-first dating application for intentional adults, designed around a complete, account-free hackathon demonstration. Piper asks what matters, drafts a profile for human approval, and introduces a small set of fictional people through reciprocal filtering and explainable ranking. When important information is missing, a consent-based question can change the introduction.

**Phase 2** turns recommendations into a complete AI matchmaking journey:

> AI onboarding → reciprocal matching → **agent-to-agent investigation** → human approval → **shared availability** → **first-date planning**

Each person has a personal AI matchmaker. For a promising, already-eligible introduction, the two matchmakers hold a short, bounded, sequential Gemini conversation using only approved profile facts, verify every factual claim against those facts, and surface what is confirmed, what differs, and what is still unknown. After a mutual yes, the matchmakers compare consented general availability and suggest first-date activity types. People make every decision.

This is a working hackathon application, not a scientifically validated compatibility predictor or a launch-ready public dating service.

## Quick start

Use Node.js 24 and npm. The package name is `pied-piper`, regardless of the checkout folder name.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3000**. `npm.cmd` avoids Windows PowerShell execution-policy restrictions on `npm.ps1`. On macOS/Linux, use `npm` normally.

The existing `.env.local` was preserved unchanged. For a **new clone only**, create `.env.local` from `.env.example` and fill in your own settings. Never overwrite a configured environment file or commit credentials.

```bash
npm run build
npm start
```

## What is implemented

| Capability                   | Actual behavior                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page                 | Responsive ivory/coral/sage design, original illustrated characters, working navigation                                                                     |
| Gemini interview             | Server-side conversation, adaptive follow-ups, structured extraction, Zod validation, manual review                                                         |
| Guest demonstration          | No sign-in or Supabase required; 18 fictional adult profiles; local browser storage                                                                         |
| Profile                      | Editable biography, essentials, interests, values, lifestyle, age/gender/location preferences, hard dealbreakers                                            |
| Introductions                | Reciprocal eligibility, deterministic weighted ranking, supported evidence, differences, unknowns                                                           |
| Investigation                | Four supported dimensions, relevant unknowns only, opt-in question wording, explicit answer-sharing consent, decline tracking, recalculation                |
| Mutual interest              | No connection until both decisions are interested; guest counterpart decisions are explicitly simulated                                                     |
| Messages                     | Local persistent demo messages; synthetic replies only when explicitly requested and clearly labeled                                                        |
| Feedback                     | Passed introductions record feedback; an explicit opt-in increases the interest weight from 20 to 30                                                        |
| Safety                       | Adult self-attestation, profile approval, local deletion, blocking, reporting, privacy disclosures                                                          |
| Real account path            | Supabase registration/login/logout, approved profiles, real decisions, questions, matches, human messages, blocks, reports, deletion APIs and RLS migration |
| Deployment                   | Next.js production build, Vercel configuration, CI workflow                                                                                                 |
| **AI Matchmakers** (P0)      | Two Gemini agents with separate contexts, ≤3 sequential Q&A rounds, ID-verified evidence, explicit unknowns, streamed live to an "Agent Conversations" view |
| **Mutual availability** (P0) | Weekly editor, IANA time zones, deterministic UTC-interval overlap, explicit sharing consent, editable/clearable, never inferred                            |
| **First-date planning** (P0) | After mutual interest only: 2–3 grounded activity types (no invented venues/prices/hours), proposals that are not confirmed until both accept               |
| **Profile enrichment** (P1)  | "Help Piper Get to Know Me": user-written text → pending suggestions quoted from the user's own words; approve or reject each; no sensitive inference       |
| **Ready to Connect** (P1)    | Pause/resume new introductions in both directions; existing matches and messages preserved; enforced in JS and SQL                                          |

**Configuration limits:** Supabase and Vercel credentials were not present. The real-account code and SQL authorization were tested locally, but hosted Supabase sign-up/email/persistence were not verified. No Vercel deployment URL has been created or verified. Real profiles are entered manually; the guest UI does not send real dating interviews to Gemini.

## Phase 2 judge walkthrough (about five minutes)

Everything below works without signing in and without Supabase. Every simulated counterpart action is labeled as fictional.

1. Open `/onboarding?demo=1` (or **Try interactive demo**). Confirm you are an adult.
2. **Jamie talks to Gemini**: consent to sending fictional details and use the sample-message buttons, or choose **Explore the predefined demonstration** (scripted, labeled, no AI).
3. **Gemini creates Jamie's profile**; choose **Review my profile**.
4. **Jamie reviews and approves** the profile (edit anything, then approve).
5. **The reciprocal engine recommends Lena** on **Discover**.
6. On Lena's card choose **Let our AIs talk**.
7. Tick the Gemini consent and choose **Let our AIs talk** to watch two live Gemini matchmakers, or **Play the scripted demonstration** (template-based, clearly labeled, no AI). Both run the same orchestration and verification code. The agents find common ground (hiking, cooking, art, reading; kindness, curiosity, family; long-term) and an **important unknown**: Lena has not shared family plans, a firm requirement for Jamie.
8. In **Still unknown**, choose **Ask Lena with consent**. This is the existing Phase 1 consent workflow: choose a fictional answer and explicitly simulate Lena's approval (or decline).
9. **The recommendation updates** from approved information only ("Resolved with consent"; the introduction is recalculated; a conflicting answer removes it, which no AI can override).
10. Choose **I'm interested in Lena**.
11. Choose **Lena is also interested** (explicitly simulated).
12. **A mutual connection is created**; choose **Plan your first date**.
13. In **When could you meet?** choose **Add my general availability → Use Jamie's fictional sample**, tick **Share my general availability with mutual connections**, and save. Overlapping windows appear (Lena's sharing consent is part of the fictional data).
14. In **First-date ideas** tick the Gemini consent and **Ask our matchmakers for ideas**, or **Use template ideas (no AI)**.
15. Pick a time and an idea, then **Propose this plan to Lena**. It shows _Proposed · not confirmed until both accept_ until you simulate **Lena accepts**. Nothing is booked.

Also try **My AI Matchmaker** (journey tracker, Ready-to-Connect pause, availability editor, "Help Piper Get to Know Me"), other introductions (Maya has no overlap; Sophie has not shared; Jules has not entered availability; Nora is not open to meeting soon), and **Stop sharing my availability** (open proposals are withdrawn).

### Phase 1 walkthrough (still supported)

1. Open `/` and choose **Try interactive demo**.
2. Confirm the adults-only gate. To use Gemini, also consent to sending **fictional** interview details, then choose **Start talking to Piper**. Use the sample message buttons or type invented details.
3. For a reliable offline presentation, explicitly choose **Explore the predefined demonstration**. Send the two fictional sample messages. Scripted responses are always labeled; this path makes no Gemini onboarding calls.
4. Choose **Review my profile**. Inspect and edit Jamie’s details and requirements. Check the approval box and continue.
5. In **For you**, open Lena’s **A question worth asking**. Family plans are unknown and important to Jamie. You can ask Gemini to phrase the question, or use the labeled standard question.
6. Select a fictional answer. Sharing stays disabled until you explicitly simulate Lena’s consent. “Wants children” resolves the unknown and raises the ranking; “Does not want children” reveals a hard conflict and removes the introduction. Declining preserves the unknown and prevents a repeated question for that pair.
7. Click **I’m interested**, then explicitly simulate **Also interested**. A mutual connection opens.
8. Send a demo message. **Simulate a reply** inserts a clearly labeled scripted response. Refresh to verify browser persistence.
9. Explore profile edits, pass feedback, blocking, and **Delete demo data**. No real person is contacted.

Guest storage is isolated under `pied-piper:fictional-demo:v2`. Saved Phase 1 (`v1`) data is migrated automatically on first load: progress is kept, Phase 2 fields are added, and the legacy key is removed only after the migrated state is written. Interview transcripts are kept in component memory only, not local storage or the database. Demo data is never uploaded to real account tables.

## Environment configuration

| Variable                               | Required                | Purpose                                                                                          |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY`                       | For live AI             | Server-only Google API credential                                                                |
| `GEMINI_MODEL`                         | For live AI             | First-choice model for all Gemini calls                                                          |
| `GEMINI_FALLBACK_MODEL`                | Optional                | Used after a 404, a 5xx, or a timeout from `GEMINI_MODEL`; defaults to `gemini-3.5-flash`        |
| `NEXT_PUBLIC_SUPABASE_URL`             | For real accounts       | Supabase project URL                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For real accounts       | Public/publishable key, protected by database RLS                                                |
| `ALLOW_REAL_AI_PROCESSING`             | Optional, default false | Explicit operator gate for real-data API requests; manual account profiles remain the UI default |

Never put Gemini credentials in a `NEXT_PUBLIC_` variable. No service-role Supabase key is needed by this application. Public Supabase settings must be set before building because Next.js embeds them into the browser bundle.

### Gemini behavior and verification

The official `@google/genai` SDK runs only in server code. Model output uses JSON Schema and is validated with Zod. `/api/ai/onboard` produces a draft, not an approved profile. Unknown facts stay blank/null. Users must review and approve every shared profile. AI extraction can still be mistaken; review is essential.

The application preserves `.env.local` and tries the configured model first. During Phase 2 verification the configured model consistently returned **504** (upstream timeout) after ~38 s, while the fallback model answered. The fallback therefore now covers 404, 5xx, and timeouts (the configured model gets at most 25 s), and a 5-minute circuit breaker sends later calls straight to the fallback. Every fallback use is disclosed via `providerNotice` in the UI. To avoid the initial slow attempt, set `GEMINI_MODEL` to a model that is responsive for your account (for example the fallback model).

Missing credentials, invalid credentials, inaccessible models, quota/rate limits, network timeouts, malformed JSON, and invalid schema output produce explicit errors. They never masquerade as successful AI calls. The user can choose a predefined demonstration.

Grounded explanations are especially constrained: Gemini selects indices from the deterministic engine’s evidence list; the server returns the original facts. It cannot invent a new explanation claim. Question generation sends only the relevant dimension, not private interview transcripts or the other person’s preference.

```bash
npm run test:gemini
# With the application running:
npm run test:api
```

The smoke scripts use fictional inputs and do not print credentials or configured model values. The API smoke covers all three live AI routes and rejection of an invalid/unconsented request. Provider calls may consume API quota.

## AI matchmakers: agent-to-agent investigation

Implementation: `src/lib/agents.ts` (pure, isomorphic, unit-tested), streamed by `src/app/api/ai/agents/route.ts`, shown by `src/components/agents.tsx`.

Pipeline (deterministic filtering is never replaced):

1. **Hard eligibility** (`eligibility`) and **ranking** (`recommend`) run first. The orchestrator refuses an ineligible pair, and the route validates fictional + approved + eligible + consent before streaming.
2. **Approved, shareable contexts** (`buildApprovedContext`): age, general city, intention, interests, values, _known_ lifestyle attributes, and the person's own bio, each with a stable ID such as `b.interest.hiking` or `a.attr.children`. Partner preferences, dealbreakers, blocks, interview transcripts, availability, and pending AI suggestions are **never** included.
3. **Deterministic planning** (`planInvestigation`): the most important uncertainty for Jamie first (unknown hard preferences, then soft ones), then a **reciprocal** question from Lena's agent, then the next topic. At most **3 rounds**; declined questions are never re-asked.
4. **Actual sequential exchanges**: for each round, the asking agent's Gemini call receives only its own principal's facts, the topic, and the conversation so far, and produces one question. A **separate** Gemini call for the answering agent receives only _its_ principal's facts and the question, and returns `{answer, status: confirmed|unknown, evidence: [fact IDs]}`. This is not one prompt fabricating a transcript.
5. **Verification before display** (`verifyAnswer`): cited IDs must exist in the answerer's approved facts. Answers with no valid evidence become an explicit **unknown**; answers citing unapproved or foreign IDs are **rewritten** from verified facts and marked "rewritten from approved facts only". For lifestyle dimensions the check is strict: an unshared attribute can never be reported as known.
6. **Summary**: Gemini proposes common ground, differences, and an explanation; every item must cite valid IDs (common ground must cite both people), or it is dropped. **Unknowns and the verdict are deterministic** (`clarify-first` vs `worth-introducing`). There is no score, percentage, or probability.
7. **Consent loop**: an open unknown links to the existing compatibility-question workflow. Only a consented, validated answer updates the profile; the deterministic recommendation is recalculated, and the saved investigation is marked stale.

**Bounds and failure handling.** ≤3 rounds, ≤7 planned model calls plus ≤2 short rate-limit retries, 1,500 output tokens per turn and 2,500 for the summary, a whole-investigation deadline of 85 s with per-call timeouts and abort on client disconnect (`maxDuration` 120). Failures never throw away verified work: no turns yields an explicit error and the scripted option; a mid-way failure keeps completed rounds, drops a dangling question, and labels a summary "assembled without AI". Raw provider errors are never shown.

**Prompt-injection resistance.** System instructions are constant strings: names, bios, and questions travel only in the JSON data payload, which is labeled untrusted. Defense does not rely on the prompt: the model cannot change eligibility, cannot cite facts that were never sent to it, and its unverifiable claims are replaced. Tests simulate a model that obeys an injected bio.

**Scripted demonstration.** `scriptedBrain()` is a template "brain" that goes through the same orchestrator and verifier, runs in the browser, makes no network calls, and is labeled _PREDEFINED DEMONSTRATION · SCRIPTED · NOT AI-GENERATED_ on every turn.

## Availability, first dates, enrichment, and consent

- **Availability** (`src/lib/planning.ts`): general weekly windows in the person's IANA time zone. Overlap converts both patterns into absolute UTC intervals for the coming week (DST-correct), intersects them, and keeps windows of at least 60 minutes. Results are shown only when **both** people opted to share; missing availability is never treated as "free"; "not open to meeting soon" yields no suggestions. Availability never changes compatibility. Turning sharing off hides the overlap and withdraws open proposals.
- **First-date ideas** (`src/lib/dates.ts`, `/api/ai/dates`): available only after a mutual connection (enforced in the store reducer; the server recomputes overlap and consent itself). Gemini suggests 2–3 activity _types_ citing shared interests, stated activity preferences, budget level, and overlap windows. A guard rejects suggestions that name venues or state prices, opening hours, reservations, URLs, phone numbers, or addresses; ungrounded items are dropped and labeled templates fill the gap. Nothing is booked.
- **Proposals**: _proposed_ is never a confirmed date; _accepted_ by the other person is. In the guest demo the counterpart response is an explicit simulation. Proposals can be withdrawn, replaced, or cancelled; blocking withdraws them.
- **Enrichment** (`src/lib/enrichment.ts`, `/api/ai/enrich`): only text the person wrote. Every suggestion must quote the person's own words verbatim (verified server-side). Sensitive inferences (religion, orientation, ethnicity, health, income, politics, personality labels, …) are filtered. Suggestions stay **pending** and are never shared with matchmakers until approved one by one. A keyword-based, clearly labeled non-AI option is available.
- **Ready to Connect**: pausing removes you from new introductions in both directions (`recommend` and SQL `eligible_pair`) and blocks new interest; existing matches and messages remain.
- **Fictional-only AI**: all Phase 2 AI routes accept only fictional demo profiles (or require `ALLOW_REAL_AI_PROCESSING=true` for enrichment in real mode). Agents never message people; private interviews are never sent to another agent.

## Matching logic

Implementation: `src/lib/matching.ts`. Configurable defaults: `DEFAULT_WEIGHTS`.

**Eligibility is reciprocal.** Both profiles must be approved adults with completed essentials. Both age ranges and gender preferences must accept the other person. A local preference requires the same normalized city; cross-city recommendations require both people to accept them. Strict intentions must match. A confirmed answer conflicting with either person’s hard preference excludes the pair. Either direction of blocking excludes the pair.

An unknown hard-preference answer **does not prove compatibility**. It leaves a provisional introduction with an explicit unanswered question. There is no guessed answer or hidden imputation.

| Ranking signal            | Default weight | Calculation                                                                                                   |
| ------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------- |
| Relationship goal         |             30 | 1 for identical intentions; 0 otherwise                                                                       |
| Lifestyle preferences     |             25 | Confirmed desired-answer agreements across both people / all stated desired dimensions; unknowns contribute 0 |
| Shared interests          |             20 | Case-normalized unique intersection / larger set size                                                         |
| Shared values             |             20 | Same overlap calculation                                                                                      |
| Reciprocal preference fit |              5 | Average centered fit within each other’s age range                                                            |

The weighted sum determines ordering only; it is **not** a romantic compatibility probability and is never shown as one. Ties break by profile ID. An explicit feedback choice changes the interest weight to 30; hard filters are unchanged. No embeddings or trained recommendation model are used without a genuine dataset.

Investigations support `children`, `smoking`, `drinking`, and `pace`. Questions arise only for an unknown answer with a stated preference on the other side. Hard preferences are prioritized. Only a consented, validated answer becomes a profile attribute. The next ranking uses the updated facts. Declines are recorded per pair/dimension and never interpreted as an answer.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` **once in a new project** using the SQL editor, or apply it with the Supabase CLI migration workflow. Review the migration before applying it to any shared database: it explicitly sets grants on the application’s `public` schema.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and your deployment environment. Restart/rebuild.
4. Enable email/password authentication. Set the Site URL to your application origin and allow `/auth/callback` on localhost and the production origin as redirect URLs. Keep email confirmation enabled and configure email delivery for real invitations/verification.
5. Visit `/account`, register, confirm the email, and create an approved profile. A second adult test account is needed to test actual mutual interest.
6. Use two separate browser sessions to verify one-sided interest, mutual interest, participant-only messages, optional questions, blocking, and deletion against your hosted project.

**Phase 2:** then run `supabase/migrations/002_phase2.sql` (additive; `001` is unchanged). It makes `eligible_pair` respect Ready-to-Connect, and adds `member_planning` (availability and date preferences; readable only by the owner and, when the owner opts to share, by mutual, unblocked matches) and `date_proposals` (match members only; responses via `respond_date_proposal`, so nobody can accept their own proposal). `/api/account` exposes `planning`, `propose`, and `proposal-response` actions and returns visible planning and proposals. The real-account page does not yet render a date planner; wiring the existing `DatePlanner` UI to these actions is the remaining integration step once a Supabase project is available. AI investigations are not enabled for real accounts.

The migration creates `profiles`, `decisions`, `compatibility_questions`, `matches`, `messages`, `feedback`, `blocks`, and `reports`. All have row-level security. Anonymous users receive no table access. Publicly shareable profiles are visible only to authenticated, unblocked users; draft profiles stay with their owner. No interview transcript table exists.

`record_decision` serializes each pair with a database transaction lock and creates a match only after reciprocal interest and SQL eligibility checks. Clients cannot insert matches or impersonate another person’s decision. Messages require membership in an unblocked match and a sender ID equal to `auth.uid()`. Consent updates run through `answer_question`; only the subject can approve an answer. Block/report and application-data deletion use authenticated RPCs with fixed search paths.

Authentication is verified server-side with `auth.getUser()`, and RLS remains the final authorization boundary. No service-role bypass is used. Real messages are persisted and refresh every eight seconds; there is no AI-generated human message. Real-data deletion removes the application profile and dependent rows; deleting the authentication identity itself requires Supabase/operator tooling.

**Locally verified, not hosted verification:** The PostgreSQL tests run the actual migration in PGlite, providing minimal Supabase `auth.users` and `auth.uid()` scaffolding. They exercise real SQL roles, grants, policies, and RPCs. They do not verify Supabase email delivery, hosted auth cookies, production concurrency behavior, or operational moderation.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

- **78 unit/PostgreSQL tests** (Vitest):
  - Phase 1 (34): reciprocal ages/genders/locations/goals, hard constraints, blocks, deterministic ranking, evidence, unknowns, consent/decline/update behavior, explicit mutual interest, message authorization, feedback updates, SQL impersonation prevention and deletion.
  - Agents (18, `tests/agents.test.ts`): round/turn/call limits, capped rate-limit retries, refusal of ineligible pairs, context separation (each agent sees only its own principal's facts and never preferences/dealbreakers), constant system instructions, a compromised model obeying an injected bio, unknown handling, rewriting of unverified or foreign citations, summary verification, no scores, API failure and partial results, raw-error hiding, the scripted path.
  - Availability, dates, enrichment, Ready to Connect, persistence (21, `tests/phase2.test.ts`): exact overlap intervals, no overlap, different time zones across the date line, DST, not-open/missing/unconsented availability, date planning only after mutual approval, shared-interest grounding, venue-fact rejection, proposal versus confirmed date, replacement/revocation/blocking, pending/approved/rejected enrichment with no automatic mutation, paused users, v1→v2 migration.
  - SQL Phase 2 (5, `tests/database-phase2.test.ts`): paused people cannot receive new interest (with a control), existing matches survive pausing, availability privacy and consent, proposal impersonation/self-confirmation prevention, blocking and deletion cascades.
- **14 browser tests** (Playwright, desktop + mobile): the Phase 1 guest lifecycle, AI-failure fallback, all routes (including `/matchmaker` and `/agents`) fitting the viewport, the complete 15-step Phase 2 journey, the live-stream UI with a corrected turn and an early-ended stream, the agent-failure → scripted fallback, and Phase 1 → Phase 2 browser-data migration.
- **Live provider checks:** minimal Gemini request plus onboarding/extraction, question generation, grounded evidence, and invalid-input rejection.
- Production build, TypeScript, and ESLint passed during implementation.

Browser tests use installed Microsoft Edge on Windows and Playwright Chromium on other platforms. On a new Linux/macOS environment, run `npx playwright install chromium`. The test configuration starts a local server when needed. CI tests the production build. Mobile verification is Chromium device emulation, not a physical iPhone or Safari test. Screenshots are written to ignored `artifacts/`; traces on failure go to ignored `test-results/`.

`npm audit --omit=dev` found no production vulnerabilities during verification. The development dependency tree still reports seven moderate transitive findings related to the TypeScript ESLint parser’s `minimatch`; the compatible `npm audit fix` did not resolve them. Recheck upstream updates before wider adoption rather than forcing an unverified major-version override.

## Vercel deployment

No deployment has been made from this environment; a production URL is not yet verified.

1. Push this project to `https://github.com/akzholkarsybek/PiedPiper`.
2. In Vercel choose **Add New → Project**, import that repository, and select **Next.js** with the repository root as Root Directory.
3. Use **Node.js 24.x**, `npm ci`, and `npm run build`. `vercel.json` supplies the framework/build/install settings.
4. Add `GEMINI_API_KEY`, `GEMINI_MODEL`, and optionally `GEMINI_FALLBACK_MODEL` to the appropriate Vercel environments. Use a currently accessible model. Do not upload `.env.local` to GitHub. Supabase variables are optional for the judge demo.
5. Deploy. Environment changes require a new deployment.
6. For the public hackathon demo, make sure the production URL’s deployment protection permits judge access without a Vercel account. Leave real accounts unconfigured until their safety and operational requirements are ready.
7. Open the resulting URL in a signed-out/private window and complete the guest walkthrough. Confirm live Gemini or the explicitly selected predefined alternative. Do not announce the URL as working until verified.

Optional CLI path after authenticating:

```bash
npx vercel login
npx vercel link
npx vercel env add GEMINI_API_KEY production
npx vercel env add GEMINI_MODEL production
npx vercel --prod
```

Enter secrets only at the CLI prompt or through Vercel’s encrypted environment settings. Never place the key in a command argument or source file.

## GitHub workflow

The origin is intended to be `https://github.com/akzholkarsybek/PiedPiper.git`. `.gitignore` excludes local environments, dependencies, build output, reports, screenshots, and browser state. `.env.example` contains placeholders only. Never force-push or overwrite existing remote history.

If push authentication is unavailable, install GitHub CLI, then:

```bash
gh auth login
gh auth setup-git
git remote -v
git fetch origin
git log --oneline --all --decorate -10
git push -u origin Piper
```

Phase 2 is developed on the `Piper` branch (based on `origin/main`) and is not merged into `main`.

If the remote gained commits, reconcile them normally before pushing. `.github/workflows/ci.yml` runs checks, the production build, and browser tests on pushes/PRs without AI credentials.

## Architecture

```text
src/app/                  App Router pages and API handlers
src/components/           Landing, interview, profile editor, introductions, messaging,
                          agents (AI Matchmakers), date-planner, availability-editor, matchmaker hub
src/components/ui/        Locally owned shadcn-style Radix/CVA Button
src/lib/agents.ts         Approved contexts, planner, bounded orchestrator, verification, scripted brain
src/lib/planning.ts       Availability schema, IANA time-zone overlap, proposals
src/lib/dates.ts          Grounded first-date ideas, venue-fact guard, templates
src/lib/enrichment.ts     Quoted, non-sensitive, pending profile suggestions
src/lib/profile.ts        Zod schemas, supported dimensions, unknown handling
src/lib/matching.ts       Reciprocal filters, weighted rank, explainability
src/lib/demo-store.ts     Isolated, validated local-storage adapter and pure transitions
src/lib/fixtures.ts       18 explicitly fictional profiles and sample interview
src/lib/gemini.ts         Server-only SDK, structured output, fallback/error handling
src/lib/supabase/         Browser/server auth clients
src/proxy.ts              Supabase cookie refresh for account routes
supabase/migrations/      PostgreSQL tables, grants, RLS, transactional RPCs
tests/                    Matching, store, SQL authorization, browser journeys
scripts/                  Fictional AI smoke checks and tracked-file secret scan
```

The stack is Next.js App Router, React, TypeScript, Tailwind CSS 4, shadcn-compatible locally owned components, Radix Slot, Lucide, Motion, Zod, Google Gen AI, and Supabase. Original vector portraits avoid representing real people as fictional dating profiles. Fonts use local system serif/sans fallbacks, so the build has no external font-download dependency.

## Before public launch

- Replace self-attestation with an appropriate age-assurance process; establish reporting escalation and staffed moderation.
- Add shared/distributed rate limiting, bot controls, monitoring, and spending limits. The current process-local 30-requests/15-minutes limiter is not a global serverless quota boundary.
- Review provider data terms and consent/retention controls before enabling real dating information in AI requests. Do not use free-tier APIs for sensitive real-person testing.
- Run an independent security/privacy review, accessibility audit, real-device tests, and hosted two-account integration tests.
- Add account identity deletion, recovery flows, retention/audit policy, moderation tooling, and delivery guarantees before production membership.
- Matching uses a normalized city string, not distance/geospatial lookup. Real discovery is limited to 200 visible rows; message fetches are limited to 500 rows and are not production pagination.
- Guest storage is local, readable by other users of the same browser profile, and not cross-device. Private interviews disappear on reload. Synthetic answers remain marked as demo behavior.
- AI extraction can misinterpret wording; human review remains mandatory. No calibrated romantic probability is claimed.
- Agent conversations are bounded, user-initiated, and fictional-only. They are not autonomous and never run on real profiles. Enabling them for real accounts requires a provider data agreement, explicit per-person consent, server-side profile loading (not client-supplied profiles), and persistent rate limiting.
- Free-tier Gemini quotas are small: a 7-call live investigation can hit 429s. The UI then keeps verified turns or offers the labeled scripted demonstration. Live latency varies widely (about 3–40 s per call observed).
- Guest AI routes trust client-supplied fictional profiles and the client's assertion of a mutual match; this is acceptable only for fictional demo data. Real-account mutual checks live in SQL.
- Date ideas are activity types only. There is no verified location provider, so there are no venue names, prices, or opening hours. Grounding of free text is enforced via cited IDs and pattern guards, which reduce but cannot eliminate model error.
- Image enrichment (P2) is not implemented.
- Voice, embeddings, and advanced learning are intentionally outside this MVP.

## Official references

- [Next.js installation and App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
