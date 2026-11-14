# Wingmate: your AI goes on the first date

**Track: Entertainment.** Working adults aged 25–45 waste their evenings swiping and on chats that go nowhere.
Wingmate gives each person an AI agent that goes on the awkward first "agent date" with other people's agents,
**including the money talk nobody has on date one**, and only introduces the two humans when *both* agents say yes.

## What works end-to-end (no login)

1. **Onboarding** (`/start`): 3 short steps in your own words. Gemini turns them into your agent's persona
   (voice, values, money style, dealbreakers, and things it must never bring up).
2. **Pre-screen** (`/me`): a cheap, non-AI filter on mutual preferences, age range, intent, values, interests, money style and city.
3. **Live agent date** (`/date/[id]`): two Gemini agents talk turn by turn, streamed live. Nothing is scripted.
4. **Coach mode**: while the date is live, whisper to your agent ("ask what they'd do with $10k"). It works the tip in naturally.
5. **Private verdicts**: each agent reports to its own human, with chemistry / values / lifestyle / money scores, reasons, red flags and a yes or no.
6. **Mutual match → human handoff** (`/match/[id]`): the chat between the two real people unlocks. **Wingman** suggests
   3 openers based on the date, but the human edits and sends; the AI never writes as them.
7. **Invite a real person**: "Copy invite link" → they onboard → their agent immediately dates yours.

Demo profiles (16 of them, labeled "Demo profile") let a judge try it alone. The conversations with them are still
generated live. Their agents decide honestly, so not every date matches.

> **Testing two real people on one computer:** open the invite link in an incognito window.

## Quick start

The backend is Python (FastAPI) in `backend/`; the frontend is Next.js. Run both:

```bash
# 1. Backend (Python 3.9+) — http://127.0.0.1:8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add your GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

# 2. Frontend — http://localhost:3000 (proxies /api/* to the backend)
npm install
npm run dev
```

No key? The app runs in **MOCK MODE** (badge in the header) so the frontend can be built offline.

## Deploy

The repo deploys to **Vercel as one project with two services** (see `vercel.json`):
`app` (Next.js, repo root) serves every page, and `backend` (FastAPI, `backend/`) receives `/api/*`
with the path unchanged. Both are on one domain, so the browser calls `/api/...` with no CORS setup.

1. Import the repo on [Vercel](https://vercel.com/new) and leave Root Directory at the repo root (where `vercel.json` is).
2. Set env vars: `GEMINI_API_KEY` (use a key with billing enabled, because free-tier rate limits can break when several
   judges test at once) and **Upstash Redis** (`UPSTASH_REDIS_REST_URL` / `_TOKEN`). Redis is required on Vercel: the
   in-memory fallback is per function instance and is lost between requests. Do **not** set `API_URL`.
3. Open `/api/status`. It should show `{"mock":false,...,"store":"redis"}`.

To run both services locally the same way, run `vercel dev` from the repo root.

A date is about 12 Gemini calls (10 messages + 2 verdicts) and streams for roughly 20–40 seconds. The date runs as a
background task on the server, so it still finishes if the viewer closes the tab.

## Architecture

```
backend/app/        (Python, FastAPI)
  main.py        all /api routes (same paths and JSON as before)
  llm.py         Gemini wrapper (google-genai): retries, JSON schema output, mock mode
  agents.py      THE CORE: agent persona prompt, turn loop, verdicts, wingman  ← tune prompts here
  onboard.py     onboarding answers → agent persona (structured output)
  profiles.py    profile storage + step-1 pre-filter / ranking (no AI)
  seeds.json     16 demo profiles
  dates.py       dates, coach-mode nudges, matches, chat persistence
  view.py        privacy: what each viewer may see (never the other human's private verdict or notes)
  store.py       Upstash Redis REST, or in-memory fallback
API routes:
  /api/status
  /api/profiles                      POST create from onboarding
  /api/profiles/{id}                 GET (owner also sees private notes)
  /api/profiles/{id}/candidates      GET pre-screened lineup
  /api/profiles/{id}/dates           GET history + matches
  /api/dates                         POST create a date
  /api/dates/{id}                    GET
  /api/dates/{id}/run                POST → NDJSON stream of the live date + verdicts
  /api/dates/{id}/nudge              POST coach-mode whisper
  /api/matches/{id}(/messages|/wingman)
src/  (Next.js frontend)
  app/           pages: /  /start  /me  /date/[id]  /match/[id]
  lib/types.ts   TS types for the backend's JSON (keep in sync with backend/app)
  lib/client.ts  fetch helpers + NDJSON stream reader
```

**Trust and safety by design:** agents never invent facts beyond the profile, never reveal "keep private" notes,
and you never see another real person's private verdict. You only learn whether it's mutual. Humans make every real decision.

## Team split for the remaining hours

- **Agents/backend:** run 5–10 real dates and tune `agent_system()` and `verdict()` in `backend/app/agents.py` until
  conversations are specific, funny and get to money by message 4–6. This matters more than anything else.
- **Frontend:** polish `/date/[id]` (the demo moment) and mobile layout. Optional: a Stripe test-mode checkout for Plus.
- **Product/pitch:** pick 2 "golden" demo dates that reliably produce great lines, record a backup video,
  and build the 10-slide deck around the criteria (works 40%, what we sell 20%, who 15%, money 15%, new 10%).

## Business model (for the deck)

Free: 3 agent dates per week. **Plus, $19/mo:** unlimited dates, coach mode, a deep money-compatibility report and wingman.
Retention: new agent dates every week, and agents improve from your feedback.
