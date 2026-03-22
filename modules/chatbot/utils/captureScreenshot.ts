/**
 * Client-side screenshot capture utility.
 *
 * Uses html2canvas to capture the main content area of the current page
 * as a base64-encoded PNG. Runs in the user's authenticated browser.
 *
 * This replaces DOM scraping for the vision-first audit pipeline.
 * The screenshot captures EXACTLY what the user sees — no DOM parsing,
 * no selectors, no framework-specific logic.
 */

import html2canvas from 'html2canvas';

/**
 * Captures a screenshot of the main content area of the current page.
 * Returns a base64-encoded PNG string (without the data:image/png;base64, prefix).
 *
 * Scopes to the main content area, excluding navigation, sidebar, and chatbot.
 */
export async function capturePageScreenshot(): Promise<string | null> {
  try {
    // Find the main content area — ignore nav, sidebar, footer, chatbot
    const mainContent =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('.main-content') ||
      document.body;

    // Temporarily hide the chatbot widget so it doesn't appear in the screenshot
    const chatbotElements = document.querySelectorAll(
      '[class*="chatbot"], [class*="chat-widget"], [class*="chat-panel"], [id*="chatbot"]'
    );
    const originalDisplayValues: { el: HTMLElement; display: string }[] = [];

    chatbotElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      originalDisplayValues.push({ el: htmlEl, display: htmlEl.style.display });
      htmlEl.style.display = 'none';
    });

    // Capture the screenshot using html2canvas
    const canvas = await html2canvas(mainContent as HTMLElement, {
      // Capture at device pixel ratio for sharp text
      scale: window.devicePixelRatio || 2,
      // Respect current scroll position
      scrollX: 0,
      scrollY: 0,
      // Use transparent background to avoid rendering artifacts
      backgroundColor: '#ffffff',
      // Ignore elements that might cause issues
      ignoreElements: (element) => {
        // Ignore chatbot, modals, tooltips, dropdowns
        const classes = element.className?.toString?.() || '';
        return (
          classes.includes('chatbot') ||
          classes.includes('chat-widget') ||
          classes.includes('chat-panel') ||
          classes.includes('tooltip') ||
          classes.includes('modal-overlay') ||
          element.getAttribute('role') === 'tooltip' ||
          element.getAttribute('aria-hidden') === 'true'
        );
      },
      // Don't log warnings
      logging: false,
      // Use CORS for cross-origin images
      useCORS: true,
    });

    // Restore hidden chatbot elements
    originalDisplayValues.forEach(({ el, display }) => {
      el.style.display = display;
    });

    // Convert canvas to base64 PNG (strip the data URL prefix)
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    console.log(
      `[Screenshot] Captured: ${canvas.width}x${canvas.height}px, ` +
      `${(base64.length / 1024).toFixed(0)} KB`
    );

    return base64;
  } catch (err) {
    console.error('[Screenshot] Failed to capture:', err);
    return null;
  }
}
