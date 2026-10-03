/**
 * Details shown on the public Privacy Policy (/privacy) and Terms of Service (/terms).
 * The contact address and operator name can be overridden per deployment
 * (NEXT_PUBLIC_* values are inlined at build time, so redeploy after changing them).
 */
export const LEGAL = {
  appName: 'Ledger',
  /** How the product is described in the documents. */
  appDescription: 'Ledger (AI Personal Finance)',
  operator: process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME || 'Rajendra Prasad',
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || 'developer.rajan@gmail.com',
  /** Governing law and courts for the Terms. */
  jurisdiction: 'India',
  /** Update when the text of either document changes. */
  effectiveDate: '3 October 2026',
} as const;
