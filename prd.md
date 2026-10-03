Refactor my existing personal finance application into a clean, modular Next.js application, then implement the foundation for WhatsApp integration.

## Final direction

Keep ONE Next.js project and one primary application deployment. Retain the current root-level `app/` layout and existing `modules/` naming. Do not introduce a monorepo, separate backend applications, or a mandatory `src/` folder.

AgentCore Runtime is not part of this implementation. Keep orchestration behind a clear internal interface so it can be extracted later if required. Do not provision ECS or other infrastructure.

## Existing application

The project uses:
- Next.js 14, TypeScript, React, Tailwind CSS.
- Turso hosted SQLite through Drizzle ORM.
- NextAuth with Google and email/password authentication.
- User-owned financial records.
- Portfolio forms for investments, loans, properties, bank balances, and other assets.
- Excel and Google Drive imports.
- Gmail-reading agents that update loans.
- An AI chatbot with existing Gemini services.

Screenshots show:
- `app/` with pages and API folders.
- `modules/` containing admin-panel, chatbot, dashboard, and portfolio.
- `core/` containing agents, auth, config, db, services, types, and utils.
- `shared/`, `drizzle/`, `scripts/`, and documentation folders.
- Chatbot components, hooks, and browser utilities in `modules/chatbot/`.
- AI, Gmail, Excel, and other services grouped in `core/services/`.

Inspect the actual code, imports, and deployment configuration before changing anything. Folder names and the previous review are context, not proof of behavior.

## Target folder structure

```text
personal-finance-ai/
├── app/                           # Preserve existing pages and URLs
│   ├── admin/
│   ├── auth/
│   ├── dashboard/
│   ├── portfolio/
│   ├── chatbot/
│   ├── transactions/
│   ├── settings/
│   ├── data/
│   ├── api/                       # Thin backend entry points
│   │   ├── auth/
│   │   ├── investments/
│   │   ├── loans/
│   │   ├── portfolio/
│   │   ├── transactions/
│   │   ├── financial-summary/
│   │   ├── chat/
│   │   │   └── route.ts
│   │   └── webhooks/
│   │       └── whatsapp/
│   │           └── route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── modules/                       # Frontend feature code
│   ├── admin-panel/
│   ├── dashboard/
│   ├── portfolio/
│   └── chatbot/
│       ├── components/
│       ├── hooks/
│       └── utils/                 # Browser-only helpers
│
├── server/                        # Server-only application logic
│   ├── auth/
│   ├── finance/
│   │   ├── accounts/
│   │   ├── investments/
│   │   ├── loans/
│   │   ├── properties/
│   │   ├── transactions/
│   │   ├── subscriptions/         # When implemented
│   │   └── reports/
│   ├── ai/
│   │   ├── orchestrator/
│   │   ├── conversations/
│   │   ├── tools/
│   │   ├── contracts/
│   │   └── providers/
│   │       ├── gemini/
│   │       ├── anthropic/
│   │       └── openai/
│   ├── integrations/
│   │   ├── whatsapp/
│   │   ├── gmail/
│   │   ├── google-drive/
│   │   └── kite/
│   ├── imports/                   # Excel, PDF, and OCR processing
│   ├── jobs/                      # Durable job handlers and retries
│   └── db/
│       ├── client.ts
│       ├── schema/
│       └── repositories/
│
├── shared/
│   ├── components/
│   ├── schemas/
│   ├── types/
│   └── utils/
├── config/                        # Explicit server/client boundaries
├── drizzle/                       # Database migrations
├── scripts/
├── docs/
│   └── architecture/
├── public/
├── tests/                         # Cross-module integration tests
├── .env.example
└── package.json
```

This is a responsibility map, not an exhaustive list of existing routes or asset types. Preserve features omitted from the diagram. Create folders only when they have implementation.

Migrate server-only code from `core/` into `server/` according to its actual responsibility. Move client-safe configuration and types to the appropriate shared locations. Preserve browser utilities within frontend modules. Do not blindly rename or move the entire `core/` folder.

Avoid keeping duplicate implementations after migration. Remove obsolete files only after updating callers and verifying their replacements.

## Architecture boundaries

- `app/` contains pages, layouts, and API endpoints.
- `modules/` contains reusable frontend components and hooks.
- API routes handle authentication, request parsing, and responses.
- Finance services enforce ownership, validate operations, calculate financial values, and control database writes.
- Repositories contain database queries.
- The orchestrator coordinates interpretation, clarification, authorized tool calls, and responses.
- Both web chat and WhatsApp reuse the same orchestrator.
- Web forms, imports, agents, and AI tools reuse the same finance services.
- Internal modules call each other directly rather than making HTTP calls to this application’s own API.
- Guard backend modules as server-only. Never bundle secrets or database clients into browser code.

## AI provider flexibility

Support Claude, OpenAI API models, and Gemini through a common provider interface and separate adapters.

Keep the existing configured provider working by default. Provider/model selection must be server-side. Do not silently switch providers or send financial data to a different provider.

Persist user-scoped conversation history and pending clarifications independently of provider formats. Validate structured AI outputs before executing operations.

Gemini or another model interprets messages and explains verified results. Finance services perform calculations and writes. Models must not choose the acting user or bypass authorization.

Verify current official provider documentation during implementation. Clearly distinguish mocked adapter tests from live integrations verified with credentials.

## Fix persistence before adding WhatsApp writes

The earlier review reported whole-table rewrites, destructive Excel imports, and a placeholder transactions API. Verify these findings and fix confirmed issues.

- Use targeted CRUD operations.
- Make multi-step writes atomic.
- Preserve existing records during imports by default.
- Define safe duplicate handling for repeated imports.
- Implement the transactions API through shared finance services.
- Preserve user ownership and exact monetary precision.
- Confirm success only after the database commit.

Do not reset the database, discard financial records, or run destructive migrations. Prepare and review migration files before applying them to a live database.

## WhatsApp foundation

Implement:
- Meta verification handshake and request-signature validation.
- Secure linking of a verified WhatsApp number to an authenticated user.
- Persistent incoming-message tracking and processing states.
- Database-enforced duplicate prevention under concurrent retries.
- Durable background processing and retries.
- Investment and transaction interpretation.
- Financial questions using authorized finance queries.
- Follow-up questions for missing required details.
- Outgoing replies through the WhatsApp Business API.
- Rate limiting.

A message ID or source-specific identity should prevent duplicate delivery from creating duplicate records. Identical amounts and dates alone must not block legitimate separate transactions.

Store accepted messages durably before acknowledging receipt. Confirm financial entries to the user only after saving succeeds. Handle reply retries without repeating the financial write.

Inspect the actual hosting configuration and applicable limits before selecting the durable job mechanism. Do not assume a fixed Vercel timeout or that ordinary in-memory background work survives a request.

If infrastructure selection or credentials block live integration, complete independent work and document the remaining setup. Do not provision paid services, deploy, or send real WhatsApp messages.

## Implementation process

1. Inspect the repository and report verified architecture and persistence issues.
2. Show a concise mapping from existing files to target locations and a phased plan.
3. Proceed with reversible implementation without waiting for approval on routine code edits.
4. Preserve routes, existing user-facing behavior, and financial data.
5. Refactor finance persistence first, then AI orchestration and providers, then WhatsApp.
6. Avoid unrelated dependency upgrades and UI redesigns.
7. Add focused tests for ownership isolation, safe writes, import preservation, duplicate delivery, and conversation clarification.
8. Run relevant tests, type checking, linting, and the production build.

Finish with the final folder structure, implemented changes, validation results, migration instructions, required configuration, and remaining incomplete or externally unverified functionality.