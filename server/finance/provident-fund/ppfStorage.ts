import * as ppfAccountRepo from "@/server/db/repositories/ppfAccountRepository";

export type { PPFAccount } from "@/shared/types";
import type { PPFAccount } from "@/shared/types";

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
