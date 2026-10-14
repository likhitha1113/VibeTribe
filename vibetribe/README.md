# VibeTribe

**Your people. Your sport. Your moment.**

Live match rooms where sports fans react, debate and celebrate together. Real humans do the talking; AI helps you catch up and keeps the chat safer.

> **Demo build.** All fixtures, scores and seeded conversations are *sample data*, labelled as such in the UI. There is no official live sports feed.

## Features

- Home dashboard: sport selector (Cricket, Football, Kabaddi, All), sample match cards, popular rooms, active discussions
- Room discovery: search, filter by sport / match / room type, one-click join, loading / empty / error states
- Create room (public rooms), then land directly inside it
- Live room: realtime chat (Supabase Realtime), presence ("N online"), per-message emoji reactions, quick-reaction bar, older-message pagination, reconnect handling
- **Catch Me Up**: on-demand AI summary of the last 60 messages (topics, reactions, unanswered questions), cached, rate limited, with a deterministic fallback if the LLM is down
- **Moderation**: validation, PII blocking (email / phone / ID / private-chat links), configurable abuse + threat rules, LLM only for ambiguous cases, 3-strikes **per-room** removal, reporting (3 distinct reports hide a message for review)
- Supabase Auth (email + password), editable display name

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime, RLS) · Gemini or Claude API (server only) · Vercel

## 1. Prerequisites

Node.js 20+, a Supabase project, an LLM API key (Gemini free tier is enough), Git.

## 2. Local setup

```bash
npm install
cp .env.example .env.local     # then fill in the values
```

**Supabase dashboard**
1. *Project Settings → API*: copy Project URL, `anon` key, `service_role` key into `.env.local`.
2. *Authentication → Providers → Email*: enabled. For the demo, switch **off** "Confirm email" so sign-up works instantly.
3. *SQL Editor*: run `supabase/schema.sql`, then `supabase/seed.sql` (both are safe to read first; schema is run once, seed can be re-run).
4. *Authentication → URL Configuration*: add `http://localhost:3000` (and your Vercel URL later) to Site URL / Redirect URLs.

```bash
npm run dev      # http://localhost:3000
npm test         # moderation + catch-up unit tests
npm run typecheck
npm run build
```

`SUPABASE_SERVICE_ROLE_KEY` and the LLM key are **server-only** (never prefixed `NEXT_PUBLIC_`).

## 3. Deploy (Vercel)

1. Push to GitHub, then *Vercel → Add New → Project* and import the repo (framework auto-detected).
2. Add every variable from `.env.example` under *Settings → Environment Variables*.
3. Deploy, then add the Vercel URL to Supabase *Authentication → URL Configuration*.
4. Open the URL and run the checklist in `TESTING.md`.

## 4. Architecture

```
Browser ──(anon key + user JWT, RLS)──► Supabase  (read rooms/messages, join/leave, react, report, Realtime)
   │
   └──► Next.js Route Handlers (server)
          /api/messages  auth → membership → rate limit → moderate → store (service role)
          /api/catchup   auth → membership → rate limit → cache → LLM → validate → fallback
          /api/rooms     auth → validate → rules → insert (as the user, RLS enforced)
          /api/profile   auth → validate → update own profile
```

```
src/lib/moderation/   config.ts (editable lists) · rules.ts (pure) · pipeline.ts (decision logic) · llm-classifier.ts
src/lib/llm.ts        provider-agnostic server LLM client (Gemini | Anthropic)
src/lib/catchup.ts    prompt, schema, pseudonymisation, fallback summary
supabase/             schema.sql (tables, RLS, triggers) · seed.sql
```

### Key engineering decisions

- **Messages have no client write path.** `messages` has *no* INSERT/UPDATE/DELETE policy (and privileges are revoked). The only way to post is `/api/messages`, which takes the sender from the session cookie, checks membership, moderates, then inserts with the service role. So direct-to-DB writes can't bypass moderation or spoof a sender.
- **Reads are RLS-gated**: only members can read a room's messages, which also scopes Realtime subscriptions.
- **Strikes are per room, never account-wide, and atomic** (`register_strike()` SQL function, service role only). Only deterministic hits or a high-confidence (≥0.85) LLM verdict create a strike; uncertain or failed AI calls never punish. PII blocks don't strike.
- **LLM is the exception, not the rule.** Clean messages never call it; only messages that look aimed at a person ("you" + insult/threat words) do. Without an LLM the pipeline still works.
- **Privacy**: moderation log stores category/source/reason only (no message text, no matched PII). Catch-up prompts pseudonymise senders ("Fan A"). Names default to non-email values.
- **Cost control**: summaries on demand only, ≤60 messages, 1 request / 8s and 15 / hour per user, cached until the room changes (10 min TTL).
- **Add a sport**: `insert into sports (slug,name,emoji) values ('basketball','Basketball','🏀');` Nothing else changes (optionally add a colour in `src/lib/sports.ts`).
- **Swap in real match data**: replace the `matches` rows (or a sync job writing to that table). No code depends on an external API.

## 5. Moderation policy (tuning)

Edit `src/lib/moderation/config.ts` (or set `MODERATION_EXTRA_BLOCKLIST`). Set `MODERATION_LLM_ENABLED=false` for deterministic-only mode. Tests in `tests/moderation.test.ts` show intended behaviour for banter vs abuse.

## 6. Known limitations

- **Rate limits are in-memory per server instance**: fine for a demo, not strict on serverless. Use Redis/Upstash for production.
- **Private rooms are not implemented** (the schema constrains rooms to `public`; the README of the SQL notes where to extend).
- **Keyword/regex moderation is imperfect**: obfuscated slurs, other languages and creative PII formats can slip through; it is a first line of defence, not a guarantee. Reports + review are the backstop. There is no moderator dashboard; reports are stored and can be reviewed in Supabase.
- Reported messages are hidden in the UI, but their text is still returned to members by the API.
- Presence counts distinct signed-in users in a room's channel; it is best-effort.
- Reaction DELETE realtime events can't be room-filtered by Supabase, so they are applied only if the message is already loaded locally.
- Email/password only; no password reset UI (Supabase can send reset mails, but no screen is built).
- Not run against a live Supabase project in the build environment (see `TESTING.md` for what was and wasn't verified).
