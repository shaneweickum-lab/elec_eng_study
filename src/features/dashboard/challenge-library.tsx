"use client";

import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { getSkill } from "@/content/curriculum";
import { CHALLENGES } from "@/domain/challenges/definitions";
import { challengeLockReasons, isChallengePassed } from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ChallengeLibrary() {
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  return (
    <ol className="space-y-3">
      {CHALLENGES.map((c) => {
        const locks = hydrated ? challengeLockReasons(progress, c) : [];
        const passed = hydrated && isChallengePassed(progress, c.id);
        const attempts = progress.attempts.filter((a) => a.challengeId === c.id);
        const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
        return (
          <li key={c.id}>
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <div className="lcd flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-background text-lg text-amber">C{c.order}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{c.title}</h3>
                  <span className="text-xs text-muted-foreground" aria-label={`Difficulty ${c.difficulty} of 5`}>
                    {"■".repeat(c.difficulty)}
                    <span className="opacity-30">{"■".repeat(5 - c.difficulty)}</span>
                  </span>
                  {passed && (
                    <Badge variant="success">
                      <CheckCircle2 /> Passed
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.targetSkills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {getSkill(s)?.name ?? s}
                    </Badge>
                  ))}
                  <Badge variant="outline">Timed limit {formatDuration(c.scoring.timeLimitSeconds)}</Badge>
                </div>
                {locks.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber">
                    <Lock className="size-3.5" /> {locks.join(" · ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                {attempts.length > 0 && (
                  <div className="mb-2 text-xs text-muted-foreground">
                    {attempts.length} attempt{attempts.length === 1 ? "" : "s"} · best {best}
                  </div>
                )}
                <Button asChild variant={locks.length > 0 ? "secondary" : "default"}>
                  <Link href={`/challenges/${c.id}`} data-testid={`challenge-link-${c.id}`}>
                    {locks.length > 0 ? "View" : passed ? "Practice again" : "Start"}
                  </Link>
                </Button>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
