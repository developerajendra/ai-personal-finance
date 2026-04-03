import * as ppfAccountRepo from "@/core/db/repositories/ppfAccountRepository";

export interface PPFAccount {
  id: string;
  memberId?: string;
  memberName?: string;
  establishmentId?: string;
  establishmentName?: string;
  depositEmployeeShare: number;
  depositEmployerShare: number;
  withdrawEmployeeShare: number;
  withdrawEmployerShare: number;
  pensionContribution: number;
  grandTotal: number;
  extractedFrom?: string;
  extractedAt: string;
  lastUpdated?: string;
  rawData?: any;
}

export function loadPPFAccounts(userId: string): PPFAccount[] {
  return ppfAccountRepo.findByUserId(userId);
}

export function savePPFAccount(userId: string, account: PPFAccount): void {
  const existing = ppfAccountRepo.findById(userId, account.id);
  if (existing) {
    ppfAccountRepo.update(userId, account.id, account);
  } else {
    ppfAccountRepo.create(userId, account);
  }
}

export function savePPFAccounts(userId: string, accounts: PPFAccount[]): void {
  for (const account of accounts) {
    savePPFAccount(userId, account);
  }
}
