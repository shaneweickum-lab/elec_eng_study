import type { Metadata } from "next";
import { TIER_1_MODULES, PATHWAYS } from "@/content/curriculum";
import { PageHeader } from "@/components/shell/page-header";
import { ModuleList } from "@/features/academy/tier-view";

export const metadata: Metadata = { title: "Tier 1" };

export default function Tier1Page() {
  const pathway = PATHWAYS.find((p) => p.id === "tier-1")!;
  return (
    <div>
      <PageHeader eyebrow={pathway.subtitle} title={pathway.title} description={pathway.description} />
      <ModuleList modules={TIER_1_MODULES} />
    </div>
  );
}
