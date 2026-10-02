import type { BankBalance, Investment, Loan, Transaction } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';

export interface CashEvent {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  title: string;
  sub: string;
  /** INR, positive = money in */
  amount: number;
  /** projected rather than contractual (salary, maturity value not recorded) */
  expected?: boolean;
  href: string;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfToday = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};
const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
};

function receivableTotal(bb: BankBalance) {
  const principal = bb.balance || 0;
  if (!bb.interestRate || !bb.issueDate) return principal;
  const issue = new Date(bb.issueDate);
  const due = bb.dueDate ? new Date(bb.dueDate) : new Date();
  const days = Math.max(0, Math.floor((due.getTime() - issue.getTime()) / 864e5));
  return principal + principal * (bb.interestRate / 100) * (days / 365);
}

/**
 * Derive future and overdue cash events from existing records — no new table needed:
 * loan EMIs, deposit maturities, receivable due dates and a salary projection
 * from the last two salary credits.
 */
export function buildCashEvents(
  input: { loans: Loan[]; investments: Investment[]; bankBalances: BankBalance[]; transactions?: Transaction[] },
  months = 12,
) {
  const today = startOfToday();
  const horizon = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
  const upcoming: CashEvent[] = [];
  const overdue: CashEvent[] = [];

  // Loan EMIs
  for (const loan of input.loans) {
    if (loan.status !== 'active' || !loan.emiAmount) continue;
    const end = loan.endDate ? new Date(loan.endDate) : null;
    const day = Math.min(Math.max(loan.emiDate || 1, 1), 28);
    for (let i = 0; i <= months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, day);
      if (d < today || d > horizon || (end && d > end)) continue;
      upcoming.push({
        id: `emi-${loan.id}-${ymd(d)}`,
        date: ymd(d),
        title: `${loan.name} EMI`,
        sub: `${loan.interestRate}% · ${loan.type.replace('-', ' ')}`,
        amount: -loan.emiAmount,
        href: '/portfolio/loans',
      });
    }
  }

  // Deposit maturities (future) and matured-but-not-closed payouts (overdue)
  for (const inv of input.investments) {
    if (inv.status === 'closed' || !inv.maturityDate) continue;
    const d = new Date(inv.maturityDate);
    if (Number.isNaN(d.getTime())) continue;
    const amount = inv.maturityAmount ?? getCurrentInvestmentValue(inv);
    if (d < today) {
      overdue.push({
        id: `mat-${inv.id}`,
        date: ymd(d),
        title: `${inv.name} payout`,
        sub: `Matured ${fmt(inv.maturityDate)} · payout not recorded`,
        amount,
        href: '/portfolio/investments',
      });
    } else if (d <= horizon) {
      upcoming.push({
        id: `mat-${inv.id}`,
        date: ymd(d),
        title: `${inv.name} matures`,
        sub: inv.maturityAmount == null ? 'Maturity amount not recorded · using current value' : 'Maturity proceeds',
        amount,
        expected: inv.maturityAmount == null,
        href: '/portfolio/investments',
      });
    }
  }

  // Receivables
  for (const bb of input.bankBalances) {
    if (!bb.tags?.includes('receivable') || bb.paidDate || !bb.dueDate || bb.status === 'closed') continue;
    const d = new Date(bb.dueDate);
    if (Number.isNaN(d.getTime())) continue;
    const ev: CashEvent = {
      id: `recv-${bb.id}`,
      date: ymd(d),
      title: `${bb.bankName} · receivable`,
      sub: `Due ${fmt(bb.dueDate)}${bb.interestRate ? ` · principal + ${bb.interestRate}% simple interest` : ''}`,
      amount: receivableTotal(bb),
      href: '/portfolio/receivables',
    };
    if (d < today) overdue.push(ev);
    else if (d <= horizon) upcoming.push(ev);
  }

  // Salary projection from the last two salary credits
  const salaries = (input.transactions ?? [])
    .filter((t) => t.type === 'credit' && /salary/i.test(`${t.category} ${t.description}`))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
  if (salaries.length > 0) {
    const avg = salaries.reduce((s, t) => s + Math.abs(t.amount), 0) / salaries.length;
    const day = Math.min(new Date(salaries[0]!.date).getDate() || 1, 28);
    for (let i = 0; i <= months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, day);
      if (d <= today || d > horizon) continue;
      upcoming.push({
        id: `sal-${ymd(d)}`,
        date: ymd(d),
        title: salaries[0]!.description || 'Salary',
        sub: `Projected from the last ${salaries.length === 1 ? 'salary credit' : 'two salary credits'}`,
        amount: avg,
        expected: true,
        href: '/transactions',
      });
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  overdue.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, overdue };
}
