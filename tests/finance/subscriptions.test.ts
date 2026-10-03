import { describe, expect, it } from "vitest";
import { createUser } from "../helpers";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  updateSubscription,
} from "@/server/finance/subscriptions/service";
import { buildCashEvents } from "@/shared/utils/upcoming";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

const claude = { name: "Claude", plan: "Pro", category: "AI tools", amount: 20, currency: "USD", cycle: "Monthly", nextDate: inDays(5) };

describe("subscriptions", () => {
  it("creates, lists, updates and deletes for the owner only", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const sub = await createSubscription(alice, claude);

    expect(sub).toMatchObject({ name: "Claude", status: "Active", remind: true, ends: false });
    expect(await listSubscriptions(alice)).toHaveLength(1);
    expect(await listSubscriptions(bob)).toHaveLength(0);

    await expect(updateSubscription(bob, sub.id, { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteSubscription(bob, sub.id)).rejects.toMatchObject({ status: 404 });

    expect((await updateSubscription(alice, sub.id, { status: "Cancelled" })).status).toBe("Cancelled");
    await deleteSubscription(alice, sub.id);
    expect(await listSubscriptions(alice)).toHaveLength(0);
  });

  it("rejects a non-positive amount", async () => {
    const alice = await createUser("alice");
    await expect(createSubscription(alice, { ...claude, amount: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it("projects active renewals as outflows, with GST on USD plans", async () => {
    const alice = await createUser("alice");
    const active = await createSubscription(alice, claude);
    const ended = await createSubscription(alice, { ...claude, name: "Old", ends: true });
    const { upcoming } = buildCashEvents({ loans: [], investments: [], bankBalances: [], subscriptions: [active, ended] }, 3);

    expect(upcoming.length).toBeGreaterThanOrEqual(3);
    expect(upcoming.every((e) => e.title === "Claude renews")).toBe(true);
    expect(upcoming[0]!.date).toBe(inDays(5));
    expect(upcoming[0]!.amount).toBeLessThan(0);
    expect(upcoming[0]!.amount).toBeCloseTo(-20 * 83 * 1.18, 2);
  });
});
