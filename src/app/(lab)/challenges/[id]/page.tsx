import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHALLENGES, getChallenge } from "@/domain/challenges/definitions";
import { ChallengeRunner } from "@/features/bench/challenge-runner";

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getChallenge(id)?.title ?? "Challenge" };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = getChallenge(id);
  if (!challenge) notFound();
  return <ChallengeRunner challenge={challenge} />;
}
