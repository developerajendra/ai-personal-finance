import type { BankBalance } from '@/shared/types';

/**
 * A receivable that has been marked as paid. Once received, the money is expected to be
 * re-recorded wherever it went (a bank balance, an investment…), so settled receivables
 * are excluded from asset and net-worth totals to avoid counting it twice.
 * With `asOf`, only receivables paid on or before that date count as settled.
 */
export function isSettledReceivable(bb: BankBalance, asOf?: Date) {
  if (!bb.tags?.includes('receivable')) return false;
  if (!bb.paidDate) return bb.status === 'closed' && !asOf;
  return !asOf || new Date(bb.paidDate) <= asOf;
}

/** Expected receivable amount: principal plus simple interest to the due date (same rule as usePortfolioData and the AI overview). */
export function receivableExpected(bb: BankBalance) {
  const principal = bb.balance || 0;
  if (!bb.interestRate || !bb.issueDate) return { principal, interest: 0, total: principal };
  const issue = new Date(bb.issueDate);
  const due = bb.dueDate ? new Date(bb.dueDate) : new Date();
  const days = Math.max(0, Math.floor((due.getTime() - issue.getTime()) / 864e5));
  const interest = principal * (bb.interestRate / 100) * (days / 365);
  return { principal, interest, total: principal + interest };
}
