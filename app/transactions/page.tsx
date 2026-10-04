import { redirect } from "next/navigation";

// The Cash flow section was retired: monthly income and spending are planned and logged in Budget.
export default function LegacyTransactionsPage() {
  redirect("/budget");
}
