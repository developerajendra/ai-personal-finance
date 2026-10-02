# Architecture

One Next.js 14 app, one deployment (Vercel, `bom1`). No monorepo, no separate backend.

```text
app/                 Pages, layouts, and thin API routes (auth → parse → service → respond)
modules/             Frontend feature code (components, hooks, browser-only utils)
server/              Server-only logic — every module imports "server-only"
  auth/              NextAuth config + getSession
  db/                client.ts, schema/, repositories/ (all queries live here)
  finance/           Ownership, validation, money, and all financial writes
    investments/ loans/ properties/ accounts/ transactions/ portfolio/ provident-fund/ reports/
  ai/
    contracts/       Provider-neutral types (messages, tools, results)
    providers/       gemini/ anthropic/ openai/ ollama/ adapters + registry (index.ts)
    orchestrator/    handleMessage(): shared by web chat and WhatsApp
    conversations/   User-scoped history + pending clarifications (DB)
    tools/           Model-callable tools → finance services
  integrations/      gmail/ (agents, parsers), kite/, whatsapp/, finance-audit/
  imports/           Excel/Drive analysis + non-destructive portfolio import
  jobs/              Durable WhatsApp processing/sending with retries
  http/              Error → HTTP response mapping
shared/              Client-safe: types/, schemas/ (zod), utils/ (money, currency), components/
config/              server.ts (secrets, server-only) · constants.ts
drizzle/             SQL migrations (review before applying)
tests/               Vitest integration tests on a throwaway SQLite file
```

## Boundaries

- Routes never touch tables. They call finance services, and the services call repositories.
- Every repository query filters on `user_id`. Services validate input with `shared/schemas/finance.ts`; zod strips unknown keys, so a request body cannot set `userId` or `id`.
- Money is normalized to paise on write (`toMoney`), and aggregates are summed in integer paise (`sumMoney`).
- Forms, imports, Gmail agents, web chat, and WhatsApp all write through the same services.
- The model never supplies the acting user. `userId` comes from the session or a verified WhatsApp link.

## Verified issues fixed

| Finding (verified in code) | Fix |
|---|---|
| Every create/publish/chat action called `saveToJson` → `replaceAll`: delete all user rows, then re-insert them one by one, non-atomically | Targeted `INSERT … RETURNING` / `UPDATE … WHERE user_id AND id` |
| Excel/Drive import rewrote every portfolio table and replaced all transactions. A cache hit replaced investments, loans, properties, and balances with the cached file's items | `server/imports/portfolioImport.ts` only adds records, in one transaction. Transactions are fingerprinted, so re-import is a no-op |
| `/api/transactions` and `/api/financial-summary` were in-memory placeholders | Implemented via `server/finance/transactions/service.ts` |
| Update routes spread the raw body into `UPDATE … SET`, so a body containing `userId` could reassign a record to another user | Whitelisted schemas; `id`/`userId` are never updatable |
| Loan rate change and statement updates were multi-step and non-atomic | `applyLoanRateChange` / `applyLoanStatement` run in one DB transaction |
| Client component imported a server AI module | Removed; client code imports only `shared/` |
| AI selection silently fell back to another provider | Registry throws `ProviderConfigurationError` instead |

## File mapping (old → new)

| Old | New |
|---|---|
| `core/db/index.ts`, `schema.ts`, `repositories/*` | `server/db/client.ts`, `server/db/schema/`, `server/db/repositories/*` |
| `core/auth/*` | `server/auth/auth.ts`, `server/auth/session.ts` |
| `core/types` | `shared/types` (now also holds Zerodha/PPF types) |
| `core/services/currencyService`, `core/utils/investmentValueCalculator`, `scalabilityService` | `shared/utils/currency`, `shared/utils/investmentValue`, `shared/utils/pagination` |
| `core/config/constants` | `config/constants` |
| `core/services/jsonStorageService` | **removed**; replaced by finance services |
| `core/services/aiModelService` | **removed**; replaced by `server/ai/providers/index.ts` + `config/server.ts` |
| `core/services/geminiService` | `server/ai/orchestrator/prompts.ts` + `orchestrator/index.ts` |
| `geminiJsonService`, `ollamaService`, `ollamaCacheService` | `server/ai/providers/gemini/client.ts`, `ollama/client.ts`, `ollama/cache.ts` |
| `gmailService`, `emailParserService`, `loanEmail*`, `loanReferenceDataService`, `core/agents/*` | `server/integrations/gmail/**` |
| `zerodhaService` | `server/integrations/kite/zerodhaService.ts` |
| `mcpAuditService` | `server/integrations/finance-audit/mcpAuditService.ts` |
| `excelAnalyzerService`, `cacheService`, `categoryLearningService` | `server/imports/excelAnalyzer.ts`, `analysisCache.ts`, `categoryLearning.ts` |
| `archiveService`, `snapshotCalculatorService`, `loanAnalyticsService`, `ppfStorageService` | `server/finance/reports/*`, `server/finance/loans/loanAnalytics.ts`, `server/finance/provident-fund/ppfStorage.ts` |

All URLs are unchanged. The new routes are `/api/chat` (same handler as `/api/modules/chatbot/message`), `/api/webhooks/whatsapp`, `/api/jobs/whatsapp`, and `/api/integrations/whatsapp/link`.

## AI providers

`config/server.ts` resolves providers per use case: `AI_CHAT_PROVIDER`, `AI_JSON_PROVIDER`, and `AI_ANALYSIS_PROVIDER`, each defaulting to `AI_PROVIDER` (default `gemini`).

- **Adapters:** Anthropic (official SDK), OpenAI (Chat Completions over `fetch`), Gemini (`@google/generative-ai` function calling), and Ollama (text-only; keeps the legacy `<action>` JSON protocol).
- **Explicitly pinned providers (unchanged):** Excel analysis and PPF PDF parsing use Ollama, and the formula generator and screenshot audit use Gemini. These keep their previous provider on purpose, so no data goes to a different provider.

The orchestrator's tool-call loop:

1. It loads history and any open clarification, then asks the model.
2. It validates each tool call with zod.
3. If required fields are missing, it stores a pending clarification and asks a deterministic follow-up question.
4. Otherwise it executes the call through the finance services.
5. It appends confirmations built from the committed rows, never from model text.

## WhatsApp pipeline

```text
Meta ──POST (signed)──▶ /api/webhooks/whatsapp
   1 verify X-Hub-Signature-256 (HMAC-SHA256, raw body, App Secret)
   2 INSERT inbound … ON CONFLICT(wa_message_id) DO NOTHING   ← duplicate deliveries collapse here
   3 per-sender rate limit (DB fixed window)
   4 200 OK
   5 waitUntil: claim (conditional UPDATE) → orchestrator → [tx: mark processed + queue reply] → send
/api/jobs/whatsapp (cron/Bearer CRON_SECRET) sweeps: unprocessed, failed-with-backoff, stale locks, unsent replies
```

- **Idempotent writes:** each financial write is keyed on `(user_id, source='whatsapp', source_ref='<wamid>:<kind>:<n>')` with a unique index. A retried message returns the original row. Two different messages with the same amount and date are two rows.
- **Reply retries:** retrying a reply resends only the outbound row; it never re-runs the write. Confirmations are sent only after the write commits.
- **Linking:** in Settings, the signed-in user enters a number and gets a 6-digit code (stored hashed, valid 10 minutes, locked after 5 wrong attempts). The user sends `LINK <code>` from that number, and the signed webhook proves possession.

### Hosting constraints (from `vercel.json`)

- Functions have `maxDuration: 60`. The plan tier isn't recorded in the repo, so cron frequency is unknown: Hobby allows daily crons only.
- No cron entry is added to `vercel.json`, because a sub-daily schedule fails deployment on Hobby. Choose one of:
  - **Vercel Pro:** add `"crons": [{ "path": "/api/jobs/whatsapp", "schedule": "*/5 * * * *" }]` and set `CRON_SECRET`.
  - **Any external scheduler** (GitHub Actions, cron-job.org, Upstash QStash): `GET /api/jobs/whatsapp` with `Authorization: Bearer $CRON_SECRET` every 1–5 minutes.
- Without a scheduler, each new webhook call also sweeps up to 5 due jobs. That is opportunistic, not guaranteed.

## Migration instructions

`drizzle/0001_whatsapp_conversations_idempotency.sql` is **additive only**. It creates 7 tables, adds 4 nullable columns (`investments.source`, `investments.source_ref`, `transactions.source_ref`, `transactions.updated_at`), and creates indexes. The new unique indexes cannot conflict with existing rows, because `source_ref` is `NULL` for all of them.

1. Back up first: `turso db shell <db> .dump > backup-$(date +%F).sql`, or create a Turso branch.
2. Check whether the live DB tracks Drizzle migrations: `SELECT * FROM __drizzle_migrations;`
   - If the table exists and lists 0000, run `npm run db:migrate` with `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set.
   - If it doesn't exist (the DB was created by `scripts/migrate-to-turso.mjs`), **don't** run `db:migrate`; it would try to re-create 0000's tables. Instead, apply only `0001_…sql` in `turso db shell`, splitting on `--> statement-breakpoint`.
3. Deploy the code after the migration. The new code reads the new columns.

## Tests

`npm test` runs Vitest against a fresh, fully migrated SQLite file per test file. Coverage:

- ownership isolation
- safe targeted writes and atomicity
- import preservation and idempotent re-import
- duplicate WhatsApp delivery, concurrent processing, and reply retry without a repeated write
- linking lockout and rate limiting
- conversation clarification and cancellation
- mocked provider adapters

Adapter tests mock the SDK/`fetch`. They verify request mapping, not live provider connectivity.
