repo: developerajendra/ai-personal-finance
branch: main
design: Ledger Finance v7.dc.html

local: ai-personal-finance (attached folder, ahead of GitHub main)

## Last sync
date: 2026-10-02T15:53:10Z

### Updated in this project
- Synced against the local folder, which is ahead of GitHub main
- WhatsApp now maps to the real link flow (WhatsAppLinkCard + /api/integrations/whatsapp/link)
- Backend paths updated: core/ → server/ (finance, ai, integrations, db/repositories)
- UI files (Sidebar, pages, modules) unchanged, so no screens rebuilt

## Sync history
- 2026-10-02T15:51:35Z: GitHub main check, no changes
- 2026-10-02T15:50:38Z: Initial map of Ledger v7 screens to routes/modules/APIs; wrote handoff/IMPLEMENTATION.md; logged repo features not yet in design

## Screen map
| Design screen | Repo route | Repo files |
|---|---|---|
| App shell + sidebar | all pages | shared/components/Sidebar.tsx, app/layout.tsx, app/globals.css, tailwind.config.ts, shared/providers/Providers.tsx |
| Overview | /dashboard | app/dashboard/page.tsx, modules/dashboard/components/DashboardModule.tsx, SummaryCards.tsx, FinancialCharts.tsx, TransactionTable.tsx, modules/portfolio/components/PortfolioAnalytics.tsx |
| Portfolio overview (class cards + management table) | /portfolio | app/portfolio/page.tsx, modules/portfolio/components/PortfolioGrid.tsx |
| Stocks & funds | /portfolio/stocks, /portfolio/mutual-funds | StocksDashboard.tsx, MutualFundsDashboard.tsx, app/api/zerodha/stocks, app/api/zerodha/mutual-funds |
| Deposits & bonds | /portfolio/investments | InvestmentForm.tsx, PortfolioGrid.tsx, app/api/portfolio/investments |
| Cash & bank | /portfolio/bank-balances | BankBalancesDetailView.tsx, BankBalanceForm.tsx, app/api/portfolio/bank-balances |
| Retirement (EPF + PPF) | /portfolio/provident-fund | ProvidentFundDetailView.tsx, ProvidentFundEditForm.tsx, app/api/portfolio/ppf-accounts, app/api/modules/ppf-upload |
| Real estate | /portfolio/properties | PropertiesDetailView.tsx, PropertyForm.tsx, app/api/portfolio/properties |
| Loans | /portfolio/loans | LoansDetailView.tsx, LoanAnalyticsModule.tsx, LoanForm.tsx, app/api/loans/*, app/api/portfolio/loans |
| Receivables | /portfolio/receivables | BankBalancesDetailView.tsx (tag: receivable), data/portfolioCategories.json, app/api/portfolio/categories |
| Cash flow → Transactions | /transactions | app/transactions/page.tsx, modules/admin-panel/components/DataGrid.tsx, app/api/transactions |
| Cash flow → Monthly snapshots | /dashboard/archive | modules/dashboard/components/ArchiveModule.tsx, app/api/archive/* |
| Imports & data | /data/upload, /data/analysis | FileUploadSection.tsx, AIAnalysisSummary.tsx, GmailConnection.tsx, app/api/modules/file-upload, app/api/gmail/* |
| Assistant (chat / voice) | /chatbot + floating board | modules/chatbot/components/ChatbotPage.tsx, ChatbotBoard.tsx, ChatbotIcon.tsx, VoiceModeView.tsx, app/api/modules/chatbot/message, app/api/modules/chatbot/audit-health, app/api/chat (new, server/ai/webChatHandler.ts) |
| Assistant → WhatsApp | /settings card | modules/settings/components/WhatsAppLinkCard.tsx, app/api/integrations/whatsapp/link, app/api/webhooks/whatsapp, app/api/jobs/whatsapp, server/integrations/whatsapp/* |
| Settings | /settings | app/settings/page.tsx (renders WhatsAppLinkCard), app/api/settings |
| Themes + accents | global | app/globals.css, tailwind.config.ts |
| Performance, Subscriptions, Upcoming | none yet | New: no route or API in the repo |

## Backend layout (local)
- server/finance/* (services per class, reports/overview.ts, snapshotCalculator.ts), server/db/repositories/*, server/ai/* (orchestrator, providers: anthropic/gemini/ollama/openai, tools/financeTools.ts), shared/utils/money.ts + currency.ts

## Not in the design yet (code → design)
- /dashboard/chart, /transactions/categories, /auth/signin, /auth/register, /admin/*
- Sidebar actions: delete a dynamic category, Gmail status dot, logout menu
