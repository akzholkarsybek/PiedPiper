# Pied Piper

**Your AI finds the people. You build the relationship.**

A conversation-first dating application for intentional adults, designed around a complete, account-free hackathon demonstration. Piper asks what matters, drafts a profile for human approval, and introduces a small set of fictional people through reciprocal filtering and explainable ranking. When important information is missing, a consent-based question can change the introduction.

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

| Capability          | Actual behavior                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page        | Responsive ivory/coral/sage design, original illustrated characters, working navigation                                                                     |
| Gemini interview    | Server-side conversation, adaptive follow-ups, structured extraction, Zod validation, manual review                                                         |
| Guest demonstration | No sign-in or Supabase required; 18 fictional adult profiles; local browser storage                                                                         |
| Profile             | Editable biography, essentials, interests, values, lifestyle, age/gender/location preferences, hard dealbreakers                                            |
| Introductions       | Reciprocal eligibility, deterministic weighted ranking, supported evidence, differences, unknowns                                                           |
| Investigation       | Four supported dimensions, relevant unknowns only, opt-in question wording, explicit answer-sharing consent, decline tracking, recalculation                |
| Mutual interest     | No connection until both decisions are interested; guest counterpart decisions are explicitly simulated                                                     |
| Messages            | Local persistent demo messages; synthetic replies only when explicitly requested and clearly labeled                                                        |
| Feedback            | Passed introductions record feedback; an explicit opt-in increases the interest weight from 20 to 30                                                        |
| Safety              | Adult self-attestation, profile approval, local deletion, blocking, reporting, privacy disclosures                                                          |
| Real account path   | Supabase registration/login/logout, approved profiles, real decisions, questions, matches, human messages, blocks, reports, deletion APIs and RLS migration |
| Deployment          | Next.js production build, Vercel configuration, CI workflow                                                                                                 |

**Configuration limits:** Supabase and Vercel credentials were not present. The real-account code and SQL authorization were tested locally, but hosted Supabase sign-up/email/persistence were not verified. No Vercel deployment URL has been created or verified. Real profiles are entered manually; the guest UI does not send real dating interviews to Gemini.

## A two-minute judge walkthrough

1. Open `/` and choose **Try interactive demo**.
2. Confirm the adults-only gate. To use Gemini, also consent to sending **fictional** interview details, then choose **Start talking to Piper**. Use the sample message buttons or type invented details.
3. For a reliable offline presentation, explicitly choose **Explore the predefined demonstration**. Send the two fictional sample messages. Scripted responses are always labeled; this path makes no Gemini onboarding calls.
4. Choose **Review my profile**. Inspect and edit Jamie’s details and requirements. Check the approval box and continue.
5. In **For you**, open Lena’s **A question worth asking**. Family plans are unknown and important to Jamie. You can ask Gemini to phrase the question, or use the labeled standard question.
6. Select a fictional answer. Sharing stays disabled until you explicitly simulate Lena’s consent. “Wants children” resolves the unknown and raises the ranking; “Does not want children” reveals a hard conflict and removes the introduction. Declining preserves the unknown and prevents a repeated question for that pair.
7. Click **I’m interested**, then explicitly simulate **Also interested**. A mutual connection opens.
8. Send a demo message. **Simulate a reply** inserts a clearly labeled scripted response. Refresh to verify browser persistence.
9. Explore profile edits, pass feedback, blocking, and **Delete demo data**. No real person is contacted.

Guest storage is isolated under `pied-piper:fictional-demo:v1`. Interview transcripts are kept in component memory only, not local storage or the database. Demo data is never uploaded to real account tables.

## Environment configuration

| Variable                               | Required                | Purpose                                                                                          |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY`                       | For live AI             | Server-only Google API credential                                                                |
| `GEMINI_MODEL`                         | For live AI             | First-choice model for all Gemini calls                                                          |
| `GEMINI_FALLBACK_MODEL`                | Optional                | Used only after a model-not-found (404); defaults to `gemini-3.5-flash`                          |
| `NEXT_PUBLIC_SUPABASE_URL`             | For real accounts       | Supabase project URL                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For real accounts       | Public/publishable key, protected by database RLS                                                |
| `ALLOW_REAL_AI_PROCESSING`             | Optional, default false | Explicit operator gate for real-data API requests; manual account profiles remain the UI default |

Never put Gemini credentials in a `NEXT_PUBLIC_` variable. No service-role Supabase key is needed by this application. Public Supabase settings must be set before building because Next.js embeds them into the browser bundle.

### Gemini behavior and verification

The official `@google/genai` SDK runs only in server code. Model output uses JSON Schema and is validated with Zod. `/api/ai/onboard` produces a draft, not an approved profile. Unknown facts stay blank/null. Users must review and approve every shared profile. AI extraction can still be mistaken; review is essential.

The original configured model returned **404** during verification. The application preserves `.env.local`, tries the configured model first, then uses the documented fallback only for that error. The onboarding UI discloses fallback use. The key successfully handled onboarding, profile extraction, question generation, and evidence selection through the fallback. Set `GEMINI_MODEL` to a model available in your account to avoid the initial failed call.

Missing credentials, invalid credentials, inaccessible models, quota/rate limits, network timeouts, malformed JSON, and invalid schema output produce explicit errors. They never masquerade as successful AI calls. The user can choose a predefined demonstration.

Grounded explanations are especially constrained: Gemini selects indices from the deterministic engine’s evidence list; the server returns the original facts. It cannot invent a new explanation claim. Question generation sends only the relevant dimension, not private interview transcripts or the other person’s preference.

```bash
npm run test:gemini
# With the application running:
npm run test:api
```

The smoke scripts use fictional inputs and do not print credentials or configured model values. The API smoke covers all three live AI routes and rejection of an invalid/unconsented request. Provider calls may consume API quota.

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

- **34 unit/PostgreSQL tests:** reciprocal ages/genders/locations/goals, hard constraints, blocks, deterministic ranking, evidence, unknowns, consent/decline/update behavior, explicit mutual interest, message authorization, feedback updates, SQL impersonation prevention and deletion.
- **6 browser tests:** the complete guest lifecycle, explicit AI-failure fallback, and public-page responsiveness, each on desktop and mobile emulation.
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
git push -u origin main
```

If the remote gained commits, reconcile them normally before pushing. `.github/workflows/ci.yml` runs checks, the production build, and browser tests on pushes/PRs without AI credentials.

## Architecture

```text
src/app/                  App Router pages and API handlers
src/components/           Landing, interview, profile editor, introductions, messaging
src/components/ui/        Locally owned shadcn-style Radix/CVA Button
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
- Voice, embeddings, autonomous agent-to-agent conversations, and advanced learning are intentionally outside this MVP.

## Official references

- [Next.js installation and App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
