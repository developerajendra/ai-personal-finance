/**
 * Client-side DOM scraping utility.
 * Extracts visible tables, summary cards, and headings from the current page.
 * Runs in the user's authenticated browser — no headless browser needed.
 *
 * Filters out non-financial content: navigation, headers, login screens, FAQs, marketing.
 * Only captures data from the main content area.
 */

export interface ScrapedTable {
  sectionTitle: string;
  headers: string[];
  rows: string[][];
}

export interface ScrapedPageData {
  pageTitle: string;
  pageUrl: string;
  pageHeading: string;
  tables: ScrapedTable[];
  summaryCards: { label: string; value: string }[];
}

/**
 * Scrapes the currently visible page for financial tables and summary data.
 * Scopes to the main content area and ignores nav, sidebar, chatbot, footer.
 */
export function scrapeCurrentPage(): ScrapedPageData {
  const getText = (el: Element | null): string =>
    el?.textContent?.trim().replace(/\s+/g, ' ') || '';

  // Page info
  const pageTitle = document.title || '';
  const pageUrl = window.location.pathname;

  // Scope to main content area — ignore nav, sidebar, footer, chatbot widget
  const mainContent =
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('.main-content') ||
    document.body;

  // Find the page heading within main content
  const h1 = mainContent.querySelector('h1');
  const h2 = mainContent.querySelector('h2');
  const pageHeading = getText(h1) || getText(h2) || '';

  // Helper: check if an element is inside a region we should skip
  const isInIgnoredRegion = (el: Element): boolean => {
    const ignoredSelectors = [
      'nav', 'header', 'footer', 'aside',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '[class*="sidebar"]', '[class*="chatbot"]', '[class*="chat-"]',
      '[class*="footer"]', '[class*="header"]', '[class*="nav"]',
      '[class*="login"]', '[class*="auth"]', '[class*="faq"]',
      '[class*="testimonial"]', '[class*="banner"]', '[class*="marketing"]',
    ];
    return ignoredSelectors.some((sel) => el.closest(sel) !== null);
  };

  // Extract HTML tables from main content only
  const tables: ScrapedTable[] = [];
  const tableElements = mainContent.querySelectorAll('table');

  tableElements.forEach((table) => {
    // Skip tables inside ignored regions
    if (isInIgnoredRegion(table)) return;

    // Find section title from nearby headings or parent containers
    let sectionTitle = '';
    let prev = table.previousElementSibling;
    for (let i = 0; i < 5 && prev; i++) {
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prev.tagName)) {
        sectionTitle = getText(prev);
        break;
      }
      prev = prev.previousElementSibling;
    }
    if (!sectionTitle) {
      const parent = table.closest('section, [class*="card"], [class*="panel"], [class*="section"]');
      if (parent) {
        const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]');
        sectionTitle = getText(heading);
      }
    }

    // Headers
    const headers: string[] = [];
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr:first-child');
    if (headerRow) {
      headerRow.querySelectorAll('th, td').forEach((cell) => {
        headers.push(getText(cell));
      });
    }

    // Rows
    const rows: string[][] = [];
    const bodyRows = table.querySelectorAll('tbody tr');
    if (bodyRows.length > 0) {
      bodyRows.forEach((row) => {
        const cells: string[] = [];
        row.querySelectorAll('td, th').forEach((cell) => cells.push(getText(cell)));
        if (cells.some((c) => c.length > 0)) rows.push(cells);
      });
    } else {
      const allRows = table.querySelectorAll('tr');
      for (let i = 1; i < allRows.length; i++) {
        const cells: string[] = [];
        allRows[i].querySelectorAll('td, th').forEach((cell) => cells.push(getText(cell)));
        if (cells.some((c) => c.length > 0)) rows.push(cells);
      }
    }

    // Only include tables that have actual data rows
    if (rows.length > 0) {
      tables.push({ sectionTitle, headers, rows });
    }
  });

  // Also check for ARIA grid/table patterns (div-based tables)
  const gridContainers = mainContent.querySelectorAll('[role="grid"], [role="table"]');
  gridContainers.forEach((grid) => {
    if (grid.tagName === 'TABLE') return;
    if (isInIgnoredRegion(grid)) return;

    const gridRows = grid.querySelectorAll('[role="row"]');
    if (gridRows.length > 1) {
      let sectionTitle = '';
      const parent = grid.closest('section, [class*="card"], [class*="panel"]');
      if (parent) {
        const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"]');
        sectionTitle = getText(heading);
      }

      const headers: string[] = [];
      const rows: string[][] = [];

      gridRows.forEach((row, idx) => {
        const cells: string[] = [];
        row.querySelectorAll('[role="columnheader"], [role="cell"], [role="gridcell"]').forEach((cell) => {
          cells.push(getText(cell));
        });
        if (idx === 0 && row.querySelector('[role="columnheader"]')) {
          headers.push(...cells);
        } else if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      });

      if (rows.length > 0) {
        tables.push({ sectionTitle, headers, rows });
      }
    }
  });

  // Extract summary/stat cards from main content only
  const summaryCards: { label: string; value: string }[] = [];
  const statElements = mainContent.querySelectorAll(
    '[class*="stat"], [class*="summary"], [class*="metric"], [class*="kpi"]'
  );
  statElements.forEach((el) => {
    if (isInIgnoredRegion(el)) return;

    const label = el.querySelector('[class*="label"], [class*="title"], [class*="name"], dt, small');
    const value = el.querySelector('[class*="value"], [class*="amount"], [class*="number"], dd, strong');
    if (label && value) {
      const l = getText(label);
      const v = getText(value);
      if (l && v && l !== v) summaryCards.push({ label: l, value: v });
    }
  });

  return { pageTitle, pageUrl, pageHeading, tables, summaryCards };
}
