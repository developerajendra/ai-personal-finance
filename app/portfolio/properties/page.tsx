import { AppShell } from "@/shared/components/AppShell";
import { ClassHeader } from "@/modules/portfolio/components/ClassPages";
import { PropertiesDetailView } from "@/modules/portfolio/components/PropertiesDetailView";

export default function Page() {
  return (
    <AppShell>
      <ClassHeader classKey="property" />
      <PropertiesDetailView />
    </AppShell>
  );
}
