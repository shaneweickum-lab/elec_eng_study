"use client";

import { SKILLS } from "@/content/curriculum";
import type { MasteryLevel, SkillMastery } from "@/domain/progress/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  "not-started": "Not started",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

export function LevelBadge({ level }: { level: MasteryLevel }) {
  const variant = level === "mastered" ? "success" : level === "proficient" ? "default" : level === "developing" ? "warning" : "outline";
  return <Badge variant={variant}>{LEVEL_LABEL[level]}</Badge>;
}

export function SkillList({ mastery, compact = false }: { mastery: Record<string, SkillMastery>; compact?: boolean }) {
  return (
    <ul className="space-y-3">
      {SKILLS.map((skill) => {
        const m = mastery[skill.id]!;
        return (
          <li key={skill.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{skill.name}</span>
              <LevelBadge level={m.level} />
            </div>
            <div className="flex h-1.5 gap-0.5" role="img" aria-label={`${skill.name}: ${LEVEL_LABEL[m.level]}`}>
              {[0.25, 0.5, 0.75, 1].map((step) => (
                <span key={step} className={cn("flex-1 rounded-full", m.progress >= step - 0.05 ? (m.level === "mastered" ? "bg-success" : "bg-cyan/80") : m.progress > step - 0.25 ? "bg-cyan/30" : "bg-secondary")} />
              ))}
            </div>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                {skill.description} · {m.independentScenarios} independent scenario{m.independentScenarios === 1 ? "" : "s"}, {m.guidedScenarios} guided
                {m.masteryAssessmentPassed ? ", mastery assessment passed" : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
