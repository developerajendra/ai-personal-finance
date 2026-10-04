import { redirect } from "next/navigation";

// Transaction categories went with the Cash flow section; Budget has its own categories.
export default function LegacyCategoriesPage() {
  redirect("/budget");
}
