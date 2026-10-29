import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ProgressView } from "@/features/dashboard/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <div>
      <PageHeader eyebrow="Progress" title="Skill mastery and learning history" description="Competency is demonstrated, not accumulated. Engagement XP is shown separately and never raises a skill level." />
      <ProgressView />
    </div>
  );
}
