# Personal finance application — reusable design and prototype prompt

## Task

Design and build a polished, responsive, interactive prototype of a personal finance web application. Create a fresh visual design from scratch. Use the requirements below as the reference for financial information and workflows, rather than reproducing an existing interface.

The application should help a person understand their overall financial position, manage income and expenses, track investments and savings, monitor debts and money owed to them, and review financial history. It must work well on mobile and desktop.

Start with an interactive prototype using clearly labeled sample data. Make navigation and the main local interactions work. Do not imply that bank connections, email access, AI responses, imports, authentication, or live prices work unless they are implemented. Do not require real credentials to demonstrate the prototype.

## Visual direction

- Create a calm, clear, contemporary finance interface with strong hierarchy and restrained decoration.
- Initial direction: light surfaces, dark navy text, a teal accent, subtle separators, and generous but efficient spacing.
- Use a consistent typography, spacing, radius, and icon system. Choose accessible text sizes and contrast.
- Use color purposefully. Pair gains, losses, warnings, and statuses with text or symbols so meaning never relies on color alone.
- Avoid filling every screen with equally prominent cards or oversized charts. Prioritize information that helps the user understand changes and take action.
- Use charts for meaningful comparisons and trends. Use a simple summary when there is only one category.
- Keep currency formatting and visual patterns consistent across screens.

## Information architecture

Use these primary destinations:

1. Overview
2. Portfolio
3. Loans & receivables
4. Activity & history
5. Imports & connections
6. Assistant
7. Settings

On desktop, use a compact sidebar with clear selected states. Put global controls in a top bar: date range, display currency, privacy toggle, and a contextual Add action.

On mobile, use bottom navigation for Home, Portfolio, Activity, Assistant, and More. Put loans, imports, and settings within More or an equally clear secondary navigation. Retain direct access to important upcoming items from Home.

## Screen requirements

### Overview

Lead with net worth and a historical trend. Provide supporting summaries for available cash, investments, and outstanding debt. Include asset allocation, upcoming loan payments, investment maturities, receivables needing review, recent transactions, and data freshness or connection status.

Define totals clearly. Avoid double-counting holdings that also appear in imported or manually entered investments. Distinguish immediately available cash from other assets whose liquidity varies. Explain the net-worth calculation in a detail view.

### Portfolio overview

Group assets into Cash, Investments, Retirement, and Property. Allow users to search and explore records, open detailed views, and add or edit supported records.

Retain these source categories: investments, stocks, mutual funds, loans, properties, bank balances, provident fund, and receivables. Custom categories may be supported through a clear management flow.

Manually entered investment records may have draft, published, active, and matured states. Imported holdings should identify their source and whether they are editable. Include portfolio export and optional table audit entry points.

### Investments

Record name, type, original amount, current value, start date, maturity date, maturity amount, currency, and status. Support fixed deposits, public provident fund, other investments, and relevant custom categories. Treat missing values as unknown rather than zero.

Show source currency and converted display currency where applicable. Provide search, add, edit, status filtering, and an individual detail view.

### Stocks

Show holding count, total current value, and total profit or loss. Each holding includes symbol, exchange, quantity, average purchase price, latest recorded price, current value, gain or loss amount, and percentage.

Support a broker connection status and refresh control. Clearly distinguish cached values from live values and show the update time. The existing feature reference uses Zerodha.

### Mutual funds

Show fund count, total current value, and aggregate profit or loss. Individual records include fund name, symbol or identifier, folio, units, average purchase price, NAV, current value, gain or loss amount, and percentage.

Prefer readable fund names when available. Keep identifiers in details. Show connection and cached-data status with refresh controls.

### Loans

Prioritize outstanding balance, original principal, monthly payment, interest rate, active-loan count, next payment, and remaining tenure. Provide an individual loan detail screen with repayment progress and historical snapshots.

Snapshot fields include month, outstanding balance, principal paid, interest paid to date, monthly payment, interest rate, remaining tenure, source, and last update.

Support optional import of quarterly summaries and interest-rate changes from email. Show import results for review. Do not sum cumulative snapshot values to calculate total principal or interest paid. Keep monthly amounts distinct from lifetime totals.

### Receivables

Keep money owed to the user separate from liabilities. Include debtor, principal amount, currency, converted value, issue date, due date, interest rate, interest amount, expected total, last update, and supported edit actions.

Prioritize overdue or upcoming items when dates are available. Separate principal from interest and disclose the calculation basis. Support draft and published records, search, add, and edit.

### Properties

Show property count, purchase value, current estimated value, and appreciation amount and percentage. Individual properties include name, type, location, purchase price, current value, purchase date, ownership status, and valuation date when available.

Use a meaningful purchase-versus-current-value comparison. Keep house and land/plot categories distinct where appropriate.

### Bank balances

Show total balance, account count, active accounts, and bank count. Account details include bank or account label, account type, masked account number, balance, original currency, converted balance, update date, and status.

Support Indian rupees and Nepalese rupees. Keep original and converted balances clearly differentiated. Do not expose complete account numbers in overview screens.

### Provident fund and retirement

Show account totals, employee contributions, employer contributions, withdrawals by contribution source, and pension components as applicable. Individual records include member identifier, member name, establishment/employer, contributions, withdrawals, pension, total, and update date.

Use employer labels rather than long member identifiers in charts. Distinguish employee provident fund, public provident fund, and pension concepts correctly. Do not automatically combine pension components into withdrawable balances without a justified data definition.

### Activity and financial history

Provide income and expense transactions with filters for account, date, category, and currency. Support adding a transaction through a simple form with meaningful validation.

Include historical monthly snapshots with a year filter, trend views, and detailed comparisons. Snapshot measures include net worth, investments, liquid and fixed assets, loans, properties, stocks and mutual funds, provident fund, receivables, and last update.

Choose a clear rule for multiple snapshots in a month. Avoid impossible month counts or ambiguous duplicate records. Keep changes and comparison periods labeled.

The existing Transactions page was not inspected in the reference session. Treat these transaction requirements as proposed behavior, not a verified description of that page.

### Imports and connections

Support general financial-document uploads and a dedicated provident-fund import path. Include direct file selection or drag and drop, Google Drive links, Gmail integration, and broker connection management.

Use a clear flow: choose source → process → review extracted records → resolve warnings or duplicates → publish.

Show progress, success, failure, and retry states. Provide categorization summaries for investment, loan, property, and other extracted records. Keep extraction results distinct from financial insights.

### Assistant

Provide contextual access throughout the app plus a dedicated conversation screen. Include text input, voice-input affordance, agent selection if meaningful, and shortcuts for creating or updating investments, portfolio summaries, charts, expenses, and loans.

In the prototype, label responses as simulated. In a production implementation, show the data sources and periods used for answers. Actions that modify financial records should present the proposed change for review before saving.

### Settings

Separate profile, display preferences, connections, and advanced AI configuration. Include broker connection setup, Gmail connection, save/disconnect states, and optional AI-provider configuration.

Use masked credential fields. Never embed real secrets in the prototype. Distinguish configured credentials from an actively authenticated connection. The reference session inspected the top of Settings; lower settings were available as page text but not fully captured visually.

## Responsive interaction requirements

- Design for approximately 360px mobile, tablet, and desktop widths.
- Reflow content without clipped text or page-wide horizontal overflow.
- On mobile, present holdings and records as compact lists with expandable details or dedicated detail pages.
- On desktop, use aligned tables for comparison, with essential columns first and secondary fields in details.
- Keep actions available without hover and give touch controls comfortable targets.
- Open mobile filters and short forms in an accessible sheet or equivalent pattern.
- Preserve navigation and form usability with keyboard interaction.
- Include accessible labels, visible focus, validation messages, and reduced-motion behavior.

## Data and display rules

- Use consistent Indian digit grouping for INR, normally with no more than two decimal places for money.
- Retain the precision needed for units and financial calculations internally.
- Display signs and labels for gains and losses consistently.
- Show original currency, converted display value, conversion basis, and date when relevant.
- Show source and last-updated information for imported or cached values.
- Represent missing values explicitly. Do not substitute zero for unavailable data.
- Use synthetic sample names, accounts, transactions, and balances. Do not reproduce private identifiers, contact details, or credentials.
- Ensure all sample totals reconcile, including asset allocation, net worth, investment subtotals, and debt summaries.

## Prototype deliverables

1. Build Overview, Portfolio, and Loan Detail first to establish the design system.
2. Extend the same patterns to stocks, mutual funds, bank accounts, properties, retirement, receivables, history, imports, assistant, and settings.
3. Implement working local navigation, responsive layouts, privacy toggle, holding details, search/filter examples, and transaction entry.
4. Include realistic populated, empty, loading, disconnected, cached-data, validation, and error states where relevant.
5. Clearly identify simulated integrations and assistant behavior.
6. Present a preview that can be reviewed at mobile and desktop sizes.
7. Briefly explain the design decisions and any remaining prototype limitations.

## Quality review

Verify that the user can quickly answer: What am I worth? What cash is available? How are investments performing? What do I owe? Who owes me money? What needs attention next? How current is the data?

Check that financial summaries reconcile, primary actions work, record details are reachable, mobile navigation is clear, no content clips, and all interactive controls have an implemented response or a clear simulated state.

The reference is based on visible application screens and workflows. The underlying database schema and business logic were not inspected. Validate those separately before production integration.
