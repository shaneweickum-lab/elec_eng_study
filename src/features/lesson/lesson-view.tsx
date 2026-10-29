"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowRight, BookMarked, CheckCircle2, Clock, FlaskConical, Info, Lightbulb, ShieldAlert } from "lucide-react";
import { getLesson, getSkill, moduleOfLesson, type Block } from "@/content/curriculum";
import { CHALLENGES } from "@/domain/challenges/definitions";
import { isLessonComplete } from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { KnowledgeCheck } from "./knowledge-check";
import { OhmsLawExplorer } from "./ohms-law-explorer";
import { AnnotationContext, RichText } from "./rich-text";
import { annotateLesson } from "./annotations";
import { getGlossaryEntry } from "@/content/curriculum/glossary";

const REVIEW_LABEL = { draft: "Draft", "pending-technical-review": "Pending technical review", reviewed: "Technically reviewed" } as const;

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return (
        <p className="leading-relaxed text-foreground/85">
          <RichText text={block.body} />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("space-y-2 pl-5 text-foreground/85", block.ordered ? "list-decimal" : "list-disc")}>
          {block.items.map((item) => (
            <li key={item} className="pl-1 leading-relaxed">
              <RichText text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "formula":
      return (
        <figure className="rounded-lg border border-border bg-background/60 p-5">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-2">
            {block.expressions.map((e) => (
              <span key={e} className="lcd text-xl text-cyan">
                {e}
              </span>
            ))}
          </div>
          {block.caption && <figcaption className="mt-3 text-center text-xs text-muted-foreground">{block.caption}</figcaption>}
        </figure>
      );
    case "callout": {
      const tone = {
        safety: { icon: ShieldAlert, cls: "border-danger/40 bg-danger/5", iconCls: "text-danger" },
        note: { icon: Info, cls: "border-cyan/30 bg-cyan/5", iconCls: "text-cyan" },
        tip: { icon: Lightbulb, cls: "border-amber/30 bg-amber/5", iconCls: "text-amber" },
      }[block.tone];
      return (
        <aside className={cn("flex gap-3 rounded-lg border p-4", tone.cls)} role="note">
          <tone.icon className={cn("mt-0.5 size-5 shrink-0", tone.iconCls)} />
          <div>
            <div className="text-sm font-semibold">{block.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              <RichText text={block.body} />
            </p>
          </div>
        </aside>
      );
    }
    case "worked-example":
      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-semibold">Worked example — {block.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {block.given.map((g) => (
              <Badge key={g} variant="secondary" className="lcd">
                {g}
              </Badge>
            ))}
          </div>
          <ol className="mt-3 space-y-1 text-sm text-foreground/85">
            {block.steps.map((s, i) => (
              <li key={i} className="lcd">
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-3 border-t border-border pt-3 text-sm font-medium text-success">{block.result}</div>
        </div>
      );
    case "demo":
      return block.demo === "ohms-law-explorer" ? <OhmsLawExplorer /> : null;
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {block.headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => (
                    <td key={j} className={cn("px-3 py-2", j === 0 ? "font-medium" : "text-foreground/80")}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption && <p className="px-3 py-2 text-xs text-muted-foreground">{block.caption}</p>}
        </div>
      );
  }
}

export function LessonView({ slug }: { slug: string }) {
  const lesson = getLesson(slug)!;
  const mod = moduleOfLesson(slug);
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  const startLesson = useProgressStore((s) => s.startLesson);
  const submitCheck = useProgressStore((s) => s.submitKnowledgeCheck);
  const complete = hydrated && isLessonComplete(progress, slug);
  const annotations = useMemo(() => annotateLesson(lesson), [lesson]);
  const challenges = lesson.challenges.map((id) => CHALLENGES.find((c) => c.id === id)).filter((c) => c !== undefined);

  useEffect(() => {
    if (hydrated) startLesson(lesson);
  }, [hydrated, lesson, startLesson]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href={mod?.tier === "tier-2" ? "/academy/tier-2" : "/academy/tier-1"} className="hover:text-foreground">
            {mod?.tier === "tier-2" ? "Tier 2" : "Tier 1"} · Module {mod?.order}
          </Link>
          <Badge variant="warning">{REVIEW_LABEL[lesson.reviewStatus]}</Badge>
          <span>v{lesson.contentVersion}</span>
          {complete && (
            <Badge variant="success" data-testid="lesson-complete-badge">
              <CheckCircle2 /> Completed
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-muted-foreground">{lesson.subtitle}</p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Learning objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {lesson.objectives.map((o) => (
                <li key={o} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan/70" />
                  {o}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {lesson.sections.map((section, i) => (
          <AnnotationContext.Provider key={section.id} value={(text) => annotations.sections.get(section.id)?.get(text)}>
          <section id={section.id} className="mt-10 scroll-mt-6 space-y-4">
            <h2 className="flex items-baseline gap-3 text-xl font-semibold">
              <span className="lcd text-sm text-amber">{String(i + 1).padStart(2, "0")}</span>
              {section.title}
            </h2>
            {section.blocks.map((block, j) => (
              <BlockView key={j} block={block} />
            ))}
          </section>
          </AnnotationContext.Provider>
        ))}

        <section id="knowledge-check" className="mt-12 scroll-mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Knowledge check</h2>
          <p className="text-sm text-muted-foreground">Score at least {Math.round(lesson.knowledgeCheck.passThreshold * 100)} % to complete the lesson. Numeric answers accept prefixes, e.g. 12.3 or 50m.</p>
          <KnowledgeCheck lesson={lesson} onSubmit={(score) => submitCheck(lesson, score)} />
        </section>

        {complete && challenges.length > 0 && (
          <section className="mt-10 rounded-lg border border-cyan/30 bg-cyan/5 p-6" data-testid="lesson-next">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan">
              <FlaskConical className="size-4" /> Practice on the training bench
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Now prove it: the challenges below use the same solver to check your predictions and your measurement technique.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {challenges.map((c, i) => (
                <Button key={c.id} asChild variant={i === 0 ? "default" : "secondary"}>
                  <Link href={`/challenges/${c.id}`} data-testid={`lesson-challenge-${c.id}`}>
                    {c.title} <ArrowRight />
                  </Link>
                </Button>
              ))}
            </div>
          </section>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardContent className="space-y-4 pt-5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" /> About {lesson.estimatedMinutes} minutes
            </div>
            <nav aria-label="Lesson sections">
              <ol className="space-y-1">
                {lesson.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                      {s.title}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="#knowledge-check" className="text-muted-foreground hover:text-foreground">
                    Knowledge check
                  </a>
                </li>
              </ol>
            </nav>
            {lesson.prerequisites.recommended.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Recommended first</div>
                {lesson.prerequisites.recommended.map((s) => (
                  <Link key={s} href={`/academy/lesson/${s}`} className="mt-1 block text-cyan hover:underline">
                    {getLesson(s)?.title ?? s}
                  </Link>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Skills</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {lesson.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {getSkill(s)?.name ?? s}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Mastery criteria</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {lesson.masteryCriteria.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        {annotations.termIds.length > 0 && (
          <Card>
            <CardContent className="pt-5 text-xs">
              <details data-testid="key-terms">
                <summary className="cursor-pointer font-semibold text-muted-foreground uppercase">Key terms ({annotations.termIds.length})</summary>
                <p className="mt-2 text-muted-foreground">Underlined terms in the lesson show these definitions on hover, focus or tap.</p>
                <dl className="mt-3 space-y-2">
                  {annotations.termIds.map((id) => {
                    const entry = getGlossaryEntry(id)!;
                    return (
                      <div key={id}>
                        <dt className="font-medium text-foreground">{entry.term}</dt>
                        <dd className="text-muted-foreground">{entry.definition}</dd>
                      </div>
                    );
                  })}
                </dl>
              </details>
            </CardContent>
          </Card>
        )}
        {lesson.references.length > 0 && (
          <Card>
            <CardContent className="pt-5 text-xs text-muted-foreground">
              <div className="mb-2 flex items-center gap-1.5 font-semibold uppercase">
                <BookMarked className="size-3.5" /> References
              </div>
              <ul className="space-y-1">
                {lesson.references.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
