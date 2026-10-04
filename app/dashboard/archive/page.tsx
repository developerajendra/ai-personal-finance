import { redirect } from "next/navigation";

// Monthly snapshots moved under Performance, which charts them.
export default function LegacyArchivePage() {
  redirect("/performance/snapshots");
}
