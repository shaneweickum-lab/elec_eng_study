"use client";

import Link from "next/link";
import { ArrowRight, Award, BookOpen, Lock, Swords } from "lucide-react";
import { LESSONS, TIER_1_MODULES } from "@/content/curriculum";
import { CHALLENGES } from "@/domain/challenges/definitions";
import {
  assessmentReadiness,
  challengeLockReasons,
  computeAchievements,
  computeSkillMastery,
  computeXp,
  isChallengePassed,
  isLessonComplete,
  levelFromXp,
  recommendedNextChallenge,
  recommendedNextLesson,
  studyHistory,
} from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shell/page-header";
import { SkillList } from "./skill-list";

function Stat({ label, value, detail, progress }: { label: string; value: string; detail: string; progress?: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="lcd mt-1 text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        {progress !== undefined && <Progress className="mt-3" value={progress * 100} />}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  if (!hydrated) return <div className="text-sm text-muted-foreground">Loading progress…</div>;

  const mastery = computeSkillMastery(progress);
  const xp = computeXp(progress);
  const level = levelFromXp(xp);
  const readiness = assessmentReadiness(progress, "tier-1");
  const nextLesson = recommendedNextLesson(progress);
  const nextChallenge = recommendedNextChallenge(progress);
  const lessonsDone = LESSONS.filter((l) => isLessonComplete(progress, l.slug)).length;
  const challengesPassed = CHALLENGES.filter((c) => isChallengePassed(progress, c.id)).length;
  const achievements = computeAchievements(progress);
  const history = studyHistory(progress).slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Maintenance · Tier 1"
        title="Dashboard"
        description="Your learning pathway, recent work and demonstrated skills."
        actions={
          nextLesson ? (
            <Button asChild>
              <Link href={`/academy/lesson/${nextLesson.slug}`}>
                Continue: {nextLesson.title} <ArrowRight />
              </Link>
            </Button>
          ) : nextChallenge ? (
            <Button asChild>
              <Link href={`/challenges/${nextChallenge.id}`}>
                Next challenge: {nextChallenge.title} <ArrowRight />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lessons completed" value={`${lessonsDone} / ${LESSONS.length}`} detail="Authored Tier 1 lessons" progress={lessonsDone / LESSONS.length} />
        <Stat label="Challenges passed" value={`${challengesPassed} / ${CHALLENGES.length}`} detail="Training bench challenges" progress={challengesPassed / CHALLENGES.length} />
        <Stat label="Assessment readiness" value={`${Math.round(readiness.ratio * 100)} %`} detail={`${readiness.proficient} of ${readiness.total} Tier 1 skills proficient`} progress={readiness.ratio} />
        <Stat label={`Engagement · level ${level.level}`} value={`${xp} XP`} detail={`${level.next - level.current} XP to level ${level.level + 1}`} progress={level.current / level.next} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-cyan" /> Active pathway — Tier 1 electrical fundamentals
            </CardTitle>
            <CardDescription>Modules marked “planned” are on the roadmap and not yet authored.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {TIER_1_MODULES.map((m) => {
                const slug = m.lessonSlugs[0];
                const done = slug ? isLessonComplete(progress, slug) : false;
                const inner = (
                  <>
                    <span className="lcd w-6 text-xs text-muted-foreground">{String(m.order).padStart(2, "0")}</span>
                    <span className="flex-1 truncate">{m.title}</span>
                    {done ? <Badge variant="success">Complete</Badge> : m.status === "available" ? <Badge>Available</Badge> : <Badge variant="outline">Planned</Badge>}
                  </>
                );
                return (
                  <li key={m.id}>
                    {slug ? (
                      <Link href={`/academy/lesson/${slug}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skill proficiency</CardTitle>
            <CardDescription>Built only from safe, passed, distinct scenarios.</CardDescription>
          </CardHeader>
          <CardContent>
            <SkillList mastery={mastery} compact />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-4 text-cyan" /> Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {CHALLENGES.map((c) => {
              const locks = challengeLockReasons(progress, c);
              const passed = isChallengePassed(progress, c.id);
              return (
                <Link key={c.id} href={`/challenges/${c.id}`} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                  <span className="lcd text-xs text-amber">C{c.order}</span>
                  <span className="flex-1">{c.title}</span>
                  {passed ? <Badge variant="success">Passed</Badge> : locks.length > 0 ? <Badge variant="outline"><Lock /> Locked</Badge> : <Badge>Available</Badge>}
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Start with the recommended lesson.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="text-sm">
                    <Link href={h.href} className="hover:text-cyan">
                      {h.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {h.detail} · {formatDate(h.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-amber" /> Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.map((a) => (
              <div key={a.id} className={`rounded-md border p-3 ${a.earned ? "border-amber/40 bg-amber/5" : "border-border opacity-60"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Award className={`size-4 ${a.earned ? "text-amber" : "text-muted-foreground"}`} />
                  {a.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
