"use client";

import Link from "next/link";
import { CHALLENGES } from "@/domain/challenges/definitions";
import { assessmentReadiness, computeSkillMastery, computeXp, levelFromXp, studyHistory } from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { formatDate, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SkillList } from "./skill-list";

export function ProgressView() {
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  if (!hydrated) return <p className="text-sm text-muted-foreground">Loading progress…</p>;
  const mastery = computeSkillMastery(progress);
  const readiness = assessmentReadiness(progress, "tier-1");
  const xp = computeXp(progress);
  const level = levelFromXp(xp);
  const history = studyHistory(progress);
  const attempts = [...progress.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Demonstrated skills</CardTitle>
          <CardDescription>
            Proficient = passed safely in two distinct independent, timed or mastery scenarios. Mastered = proficient plus a mastery-mode pass. Repeating one scenario does not add evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkillList mastery={mastery} />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tier 1 assessment readiness</CardTitle>
            <CardDescription>Share of Tier 1 skills at proficient or better. Not a prediction of any external examination.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="lcd text-3xl" data-testid="readiness">
              {Math.round(readiness.ratio * 100)} %
            </div>
            <Progress className="mt-3" value={readiness.ratio * 100} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Engagement</CardTitle>
            <CardDescription>XP rewards activity with diminishing returns for repetition.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="lcd text-3xl">{xp} XP</div>
            <div className="text-sm text-muted-foreground">Level {level.level}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Challenge attempts</CardTitle>
          <CardDescription>Each attempt stores its scenario seed and challenge definition version so it can be reproduced.</CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="attempts-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Challenge</th>
                    <th className="py-2 pr-4 font-medium">Mode</th>
                    <th className="py-2 pr-4 font-medium">Seed · version</th>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Score</th>
                    <th className="py-2 pr-4 font-medium">Safety</th>
                    <th className="py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{formatDate(a.submittedAt)}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/challenges/${a.challengeId}`} className="hover:text-cyan">
                          {CHALLENGES.find((c) => c.id === a.challengeId)?.title ?? a.challengeId}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 capitalize">{a.mode}</td>
                      <td className="lcd py-2 pr-4 text-xs text-muted-foreground">
                        {a.seed} · v{a.definitionVersion}
                      </td>
                      <td className="lcd py-2 pr-4">{formatDuration(a.durationSeconds)}</td>
                      <td className="lcd py-2 pr-4">{a.score}</td>
                      <td className="lcd py-2 pr-4">{a.safetyScore}</td>
                      <td className="py-2">{a.passed ? a.safetyPassed ? <Badge variant="success">Passed</Badge> : <Badge variant="warning">Passed · unsafe</Badge> : <Badge variant="outline">Not passed</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Study history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-2">
              {history.slice(0, 40).map((h, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-2 text-sm">
                  <Link href={h.href} className="hover:text-cyan">
                    {h.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {h.detail} · {formatDate(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
