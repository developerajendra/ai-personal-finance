/**
 * ⚠️ MOCK DATA — placeholder for the Subscriptions screen.
 *
 * There is no `subscriptions` table or API yet. Replace this module with a real
 * repository + /api/subscriptions route (fields below match the planned schema in
 * design/handoff/SYNC.md: id, name, amount, currency, cycle, category, nextRenewal, status).
 * Everything that imports from here renders a visible "Sample data" badge.
 */

export type SubscriptionCycle = 'Monthly' | 'Annual';
export type SubscriptionStatus = 'Active' | 'Paused' | 'Cancelled';

export interface Subscription {
  id: string;
  name: string;
  plan: string;
  category: 'AI tools' | 'Entertainment' | 'Cloud & storage' | 'Other';
  amount: number;
  currency: 'INR' | 'USD';
  cycle: SubscriptionCycle;
  /** yyyy-mm-dd */
  nextRenewal: string;
  account: string;
  status: SubscriptionStatus;
  /** brand tile colour for the initials avatar */
  color: string;
}

/** Sample USD→INR rate incl. 18% GST, used only for the mock list. */
export const MOCK_USD_RATE = 84;
export const MOCK_GST = 0.18;

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: 's1', name: 'Netflix', plan: 'Standard', category: 'Entertainment', amount: 499, currency: 'INR', cycle: 'Monthly', nextRenewal: '2026-10-05', account: 'ICICI Bank ••4821', status: 'Active', color: '#e50914' },
  { id: 's2', name: 'ChatGPT', plan: 'Plus', category: 'AI tools', amount: 20, currency: 'USD', cycle: 'Monthly', nextRenewal: '2026-10-09', account: 'HDFC Credit Card ••3391', status: 'Active', color: '#10a37f' },
  { id: 's3', name: 'Claude', plan: 'Pro', category: 'AI tools', amount: 20, currency: 'USD', cycle: 'Monthly', nextRenewal: '2026-10-14', account: 'HDFC Credit Card ••3391', status: 'Active', color: '#c96442' },
  { id: 's4', name: 'Spotify', plan: 'Premium Family', category: 'Entertainment', amount: 179, currency: 'INR', cycle: 'Monthly', nextRenewal: '2026-10-21', account: 'ICICI Bank ••4821', status: 'Active', color: '#1db954' },
  { id: 's5', name: 'iCloud+', plan: '200 GB', category: 'Cloud & storage', amount: 219, currency: 'INR', cycle: 'Monthly', nextRenewal: '2026-10-27', account: 'Apple ID balance', status: 'Active', color: '#6e6e73' },
  { id: 's6', name: 'GitHub Copilot', plan: 'Individual', category: 'AI tools', amount: 100, currency: 'USD', cycle: 'Annual', nextRenewal: '2027-02-03', account: 'HDFC Credit Card ••3391', status: 'Active', color: '#24292f' },
  { id: 's7', name: 'Google One', plan: '2 TB', category: 'Cloud & storage', amount: 1950, currency: 'INR', cycle: 'Annual', nextRenewal: '2027-03-11', account: 'ICICI Bank ••4821', status: 'Active', color: '#4285f4' },
  { id: 's8', name: 'Disney+ Hotstar', plan: 'Super', category: 'Entertainment', amount: 899, currency: 'INR', cycle: 'Annual', nextRenewal: '2026-12-02', account: 'ICICI Bank ••4821', status: 'Cancelled', color: '#113ccf' },
];
