import { redirect } from "next/navigation";

// Subscriptions moved to its own section in the sidebar.
export default function LegacySubscriptionsPage() {
  redirect("/subscriptions");
}
