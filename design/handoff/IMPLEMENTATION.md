# Ledger v7 → ai-personal-finance: implementation specs

Design source: `Ledger Finance v7.dc.html`. Target: the local `ai-personal-finance` folder (ahead of GitHub main): Next.js 14 App Router, Tailwind 3, lucide-react, TanStack Query, recharts.
**Rule:** restyle only. Keep every query key, API call, event, form and route exactly as it works today. Match the UI to the design.

## 0. Tokens (do first)
`app/globals.css`: replace `--background/--foreground` with the theme variables below, keyed off `html[data-theme]` and `html[data-accent]`. Remove the `prefers-color-scheme` block; Midnight is an explicit theme. Change `font-family: Arial` to the system stack below, and drop `Inter` from `app/layout.tsx`.

| Token | Apple · Light | Midnight | Sand | Mint |
|---|---|---|---|---|
| --bg | #f5f5f7 | #111113 | #f4efe8 | #eef4f2 |
| --panel | #ffffff | #1c1c1e | #fffdf9 | #ffffff |
| --tile | #f5f5f7 | #2c2c2e | #f1ebe2 | #e8f1ee |
| --text | #1d1d1f | #f5f5f7 | #2b2118 | #10241f |
| --muted | #6e6e73 | #98989d | #7a6d5f | #5f756f |
| --divider | rgba(0,0,0,.1) | rgba(255,255,255,.12) | rgba(43,33,24,.12) | rgba(16,36,31,.11) |
| --side-bg | rgba(246,246,248,.8) + blur(20px) | rgba(28,28,30,.88) | rgba(237,229,217,.88) | rgba(224,236,232,.88) |
| --nav-sel | rgba(0,0,0,.075) | rgba(255,255,255,.11) | rgba(43,33,24,.085) | rgba(16,36,31,.08) |
| --gain / --loss | #1d8a3a / #d70015 | #30d158 / #ff453a | same as Light | same as Light |

Accents (`--accent`): Blue #0071e3 · Indigo #5856d6 · Graphite #3a3a3c · Teal #0e8a9b · Purple #8944ab · Navy #1d3d8f · Orange #e8590c · Pink #d6336c. Copy the 100–900 ramps from the design's theme CSS.
Font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`. Radii: 6/10/16, panels 18. Panel shadow: `0 1px 2px rgba(0,0,0,.04), 0 0 0 .5px rgba(0,0,0,.05)`.
`tailwind.config.ts`: map `colors.{bg,panel,tile,text,muted,divider,accent,gain,loss}` to `var(--…)` so components use `bg-panel text-muted` and so on.
Persist the theme and accent in `localStorage` (`ledger-theme`, `ledger-accent`) and set `<html data-theme data-accent>` from a small client component inside `Providers.tsx`.

## 1. Sidebar: `shared/components/Sidebar.tsx`
Restyle only. Keep: `baseNavigation`, the dynamic categories fetch plus the `portfolioCategoriesUpdated` listener, `handleDeleteCategory` (receivables can't be deleted), Gmail status polling, logout, collapse.
- **Width:** 252px expanded, 72px collapsed, `bg-[var(--side-bg)] backdrop-blur-xl`, inset right hairline. Replace `bg-gray-900` / `bg-purple-600`.
- **Order:** logo + collapse button, then search (⌘K), then the groups:
  - **Wealth:** Overview `/dashboard`; Portfolio `/portfolio`; Loans & receivables `/portfolio/loans`.
  - **Planning:** Cash flow `/transactions`; Upcoming (new).
  - **Bottom section, divided off:** Imports & data `/data/upload`, Assistant `/chatbot`, Settings `/settings`.
  - **Profile row, last:** avatar with the Gmail dot kept, name, eye toggle; the existing logout menu opens from it.
- **Rows:** 38px tall, radius 10, 19px lucide icon at stroke 1.75. Active: `bg-[var(--nav-sel)] font-semibold`, no shadow.
- **Portfolio children:** show the existing submenu plus dynamic categories using the design's "Rich list" variant: coloured dot · name · compact value · share bar. Values come from the same queries `app/portfolio/page.tsx` already runs; hoist them into a `usePortfolioTotals()` hook so the sidebar and the page share the cache.
- **Collapsed:** keep the hover flyout. Restyle it as a 270px panel with the class rows above.
- **Mobile (<760px):** bottom tab bar with Overview, Portfolio, Cash flow, Assistant and More.

## 2. Overview: `/dashboard`
`DashboardModule` keeps `useFinancialData()` and `PortfolioAnalytics`. New layout:
- **Net-worth figure:** 40px bold, plus a change pill and a 3M/6M/YTD seg control. The chart is a recharts AreaChart fed by `/api/archive` snapshots.
- **Statement:** assets by class minus loans equals net worth, with ₹ values right-aligned and tabular.
- **Health ratios and liquidity ladder:** computed client-side from the same data.
- `SummaryCards`: restyle as white panels with no icons (`text-sm text-muted` label, `text-2xl font-bold` value).

## 3. Portfolio overview: `/portfolio`
- **Cards:** replace the 6 quick cards with one horizontal row (`grid-flow-col auto-cols-[minmax(176px,1fr)] overflow-x-auto`). Each card: 28px tile icon, name, value at 19px bold, count, "x% of assets", and a 3px share bar. Keep the existing `Link href`s.
- **`PortfolioGrid`:** keep all logic: tabs, Draft/Published/Matured, search, add, audit, Gmail sync.
  - Restyle it as one panel: header row, then an underline tab bar with count badges, then status chips (active one tinted green), search and "Add …", then a table with a grey header (`bg-tile text-[11.5px] uppercase tracking-wide`).
  - Rows 15px tall with hover tint. Amount columns right-aligned and never truncated; only the name column truncates.

## 4. Class pages
For each of stocks, mutual-funds, investments, bank-balances, provident-fund, properties and receivables: hero with value, metadata chips and a freshness note, then a sortable table, with a right-side detail drawer on row click (existing forms open inside it).
- **Stocks + mutual funds:** keep both routes. The design merges them as "Stocks & funds" with an All/Stocks/Funds seg control, so `/portfolio/mutual-funds` renders the same view with Funds preselected.

## 5. Loans: `/portfolio/loans`
Keep `LoanAnalyticsModule` (fetch-latest, rate change, auto-update). Restyle: outstanding hero, EMI/rate/tenure metadata, a principal-vs-interest chart, and the monthly snapshot table. Receivables becomes the second tab, using the design's ageing bar and person rows.

## 6. Transactions and archive
- **`/transactions`:** `DataGrid` keeps editing and categories. Restyle as a panel table with a date-grouped list.
- **`/dashboard/archive`:** `ArchiveModule`, rendered as the "Monthly snapshots" tab.

## 7. Assistant
Keep `ChatbotProvider`, `ChatbotBoard`, `VoiceModeView` and the screenshot/scrape utils. They still call `/api/modules/chatbot/message` and `/audit-health`; leave those calls alone (`/api/chat` is the newer server path, so don't switch without testing). Restyle the bubbles: user messages in an accent fill, assistant messages on `bg-tile`, radius 18. Voice mode keeps its waveform.

**WhatsApp is real now.** Make the design's WhatsApp entry point open `WhatsAppLinkCard`. Keep its three states (none → pending with a `LINK <code>` block → verified with a "Linked +number" pill) and the GET/POST/DELETE calls to `/api/integrations/whatsapp/link`. Restyle only: `bg-panel rounded-[18px]`, accent button instead of `bg-green-600`, gain-coloured verified pill.

## 8. Settings, imports
- **Settings:** grouped panels with Theme and Accent pickers (dropdowns as in the design). Currency moves here from the header.
- **Imports:** `FileUploadSection`, `GmailConnection` and `AIAnalysisSummary` as stacked panels with a status chip each.

## 9. New in design, no backend yet
Performance (XIRR, benchmarks), Subscriptions, Upcoming calendar, WhatsApp. Build the UI against local mock data behind `NEXT_PUBLIC_FEATURE_*` flags; don't touch the existing APIs. For Performance, read from `server/finance/reports/overview.ts` and `snapshotCalculator.ts` before mocking anything.

## Acceptance
- No existing query key, route or API changed. Collapse, category delete, Gmail dot and logout still work.
- Every theme × accent pair renders with no hard-coded `gray-*` or `purple-*` classes left in restyled files.
