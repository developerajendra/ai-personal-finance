import { redirect } from "next/navigation";

/** Receivables is no longer linked in the nav; keep URL stable for bookmarks. */
export default function ReceivablesPage() {
  redirect("/portfolio");
}
