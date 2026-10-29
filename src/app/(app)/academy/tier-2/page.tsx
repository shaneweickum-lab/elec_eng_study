import type { Metadata } from "next";
import { TIER_2_MODULES, PATHWAYS } from "@/content/curriculum";
import { PageHeader } from "@/components/shell/page-header";
import { ModuleList } from "@/features/academy/tier-view";

export const metadata: Metadata = { title: "Tier 2" };

export default function Tier2Page() {
  const pathway = PATHWAYS.find((p) => p.id === "tier-2")!;
  return (
    <div>
      <PageHeader eyebrow={pathway.subtitle} title={pathway.title} description={pathway.description} />
      <ModuleList modules={TIER_2_MODULES} />
    </div>
  );
}
