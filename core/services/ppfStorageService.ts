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

export async function loadPPFAccounts(userId: string): Promise<PPFAccount[]> {
  return ppfAccountRepo.findByUserId(userId);
}

export async function savePPFAccount(userId: string, account: PPFAccount): Promise<void> {
  const existing = await ppfAccountRepo.findById(userId, account.id);
  if (existing) {
    await ppfAccountRepo.update(userId, account.id, account);
  } else {
    await ppfAccountRepo.create(userId, account);
  }
}

export async function savePPFAccounts(userId: string, accounts: PPFAccount[]): Promise<void> {
  for (const account of accounts) {
    await savePPFAccount(userId, account);
  }
}
