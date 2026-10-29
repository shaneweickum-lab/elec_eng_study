import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeLibrary } from "@/features/dashboard/challenge-library";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Challenge library"
        title="Training bench challenges"
        description="Five progressively harder exercises on one simulation engine. Each attempt uses a seeded scenario, so values change between attempts and every attempt can be reproduced."
      />
      <ChallengeLibrary />
    </div>
  );
}
