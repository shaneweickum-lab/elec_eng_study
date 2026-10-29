"use client";

import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { getLesson, type CurriculumModule } from "@/content/curriculum";
import { isLessonComplete } from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ModuleList({ modules }: { modules: readonly CurriculumModule[] }) {
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {modules.map((m) => {
        const lessons = m.lessonSlugs.map(getLesson).filter((l) => l !== undefined);
        const done = hydrated && lessons.length > 0 && lessons.every((l) => isLessonComplete(progress, l.slug));
        return (
          <li key={m.id}>
            <Card className={m.status === "planned" ? "h-full border-dashed bg-card/40" : "h-full"}>
              <div className="flex items-start gap-3 p-4">
                <span className="lcd mt-0.5 text-sm text-amber">{String(m.order).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{m.title}</h3>
                    {done ? <Badge variant="success">Complete</Badge> : m.status === "available" ? <Badge>Available</Badge> : <Badge variant="outline"><Lock /> Planned</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
                  {lessons.map((l) => (
                    <Link key={l.slug} href={`/academy/lesson/${l.slug}`} className="mt-3 flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-cyan/40 hover:bg-accent" data-testid={`lesson-link-${l.slug}`}>
                      <span>{l.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" /> {l.estimatedMinutes} min
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
