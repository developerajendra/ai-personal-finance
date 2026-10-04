source: local folder ai-personal-finance (Next.js 14, Tailwind 3, lucide-react, recharts)
design: Personal Finance v7.dc.html
direction: design → code (preserve all existing data fetching, APIs, auth and repositories)

## Last sync
date: 2026-10-02
### Updated in this project
- Mapped all 11 v7 screens to repo routes/components
- Extracted theme tokens → handoff/theme.css + handoff/tailwind.config.ts
- Defaults locked: Apple skin, Teal accent, Rich list subnav, no top control row

## Screen map
| Design screen | v7 screen id | Repo files | Status |
|---|---|---|---|
| Shell: sidebar (Rich list subnav), mobile floating tab bar + More sheet, theme/accent picker | `overview|more` | app/layout.tsx, app/globals.css, tailwind.config.ts, shared/components/Sidebar.tsx, shared/providers/Providers.tsx | Changed + new (tab bar, More sheet) |
| Overview — net worth, health check, liquidity ladder | `overview` | app/dashboard/page.tsx, modules/dashboard/components/DashboardModule.tsx, SummaryCards.tsx, FinancialCharts.tsx, server/finance/reports/overview.ts | Changed |
| Performance (Trends) — month rows, What changed, class trends | `trends` | app/dashboard/archive/page.tsx, app/dashboard/chart/page.tsx, modules/dashboard/components/ArchiveModule.tsx, server/finance/reports/archiveService.ts, snapshotCalculator.ts | Rebuilt |
| Portfolio — allocation across 6 classes | `portfolio` | app/portfolio/page.tsx, modules/portfolio/components/PortfolioGrid.tsx, PortfolioAnalytics.tsx, server/finance/portfolio/service.ts | Changed |
| Asset class detail — Stocks & funds (merged), Deposits/Cash, Retirement, Property | `assets` | app/portfolio/stocks, mutual-funds, investments, bank-balances, provident-fund, properties /page.tsx; StocksDashboard.tsx, MutualFundsDashboard.tsx, BankBalancesDetailView.tsx, ProvidentFundDetailView.tsx, PropertiesDetailView.tsx | Changed (stocks+funds merged) |
| Loans & receivables — ageing buckets, principal/interest/term progress | `loans` | app/portfolio/loans/page.tsx, app/portfolio/receivables/page.tsx, LoansDetailView.tsx, LoanAnalyticsModule.tsx, LoanForm.tsx | Redesigned |
| Cash flow — transactions, monthly snapshot, subscriptions | `activity` | app/transactions/page.tsx, app/transactions/categories/page.tsx, modules/dashboard/components/TransactionTable.tsx | Changed + new (Subscriptions) |
| Upcoming — 90-day cash events | `calendar` | — none (new route app/upcoming/page.tsx) | New |
| Imports — file / Drive / Gmail, duplicate + missing checks | `imports` | app/data/upload/page.tsx, app/data/analysis/page.tsx, modules/admin-panel/components/FileUploadSection.tsx, GmailConnection.tsx | Changed |
| Assistant — panel, full screen, voice orb, WhatsApp | `assistant` | app/chatbot/page.tsx, modules/chatbot/components/ChatbotBoard.tsx, ChatbotPage.tsx, ChatbotIcon.tsx, VoiceModeView.tsx, hooks/useChatbot.tsx | Changed |
| Settings — profile, appearance, AI provider, connections | `settings` | app/settings/page.tsx, modules/settings/components/WhatsAppLinkCard.tsx | Changed |

## Implementation order
1. Tokens: replace tailwind.config.ts; import theme.css in globals.css; drop Arial body font and Inter in layout.tsx → system SF stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif`); set html data-theme="apple" data-skin="apple" data-accent="teal". Persist pick in localStorage key `pf-theme`.
2. Shell: Sidebar.tsx → Dashboard / Performance / Portfolio (auto-expand on /portfolio/*, faint chevron always visible, Rich list rows = icon · name · value · share%) / Loans / Cash flow / Upcoming / Imports / Settings. Merge Stocks + Mutual Funds into one "Stocks & funds" entry. Mobile (<768px): hide sidebar, floating tab bar Home · Trends · Portfolio · Cash flow · More; More sheet holds remaining routes + design/colour picker.
3. Page header pattern on every page: h1 title + primary "Add" pill button only. Remove date-range / currency / hide-amount row (lives in Settings + chart toggles).
4. Overview → Portfolio → Asset classes → Loans & receivables.
5. Cash flow + Subscriptions (needs new `subscriptions` table + repository).
6. Performance (reuse financialSnapshotRepository monthly snapshots).
7. Upcoming (derive from loans EMIs, receivable due dates, subscription renewals, deposit maturities).
8. Assistant + Settings.

## New data needed
- subscriptions: id, userId, name, amount, currency (INR|USD), cycle (Monthly|Annual), category, nextRenewal, status (Active|Paused|Cancelled)
- receivables: add dueDate, interestRate, startDate to derive ageing (overdue / ≤90d / later)
- upcoming events: computed server-side, no table

## Component rules (from v7)
- Panel: bg panel, radius 18px, padding 22px 24px, shadow-panel; clickable panels lift 1px + shadow-lift on hover
- Buttons: pill (radius 980px), weight 500; secondary = rgba(0,0,0,.05) bg
- Segmented control: track rgba(118,118,128,.12), radius 9px, 2px pad; option radius 7px, 30px min height, selected = surface + small shadow
- Inputs radius 10px; dialogs radius 20px
- h1 700 / -0.025em; h2 650
- Gains/losses always use gain/loss tokens, never accent
- Asset-class colours: cls.* tokens (stock/fund/dep follow accent)
- Sidebar: side-bg with backdrop blur(20px) saturate(180%); tab bar rgba(255,255,255,.84) same blur
