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
