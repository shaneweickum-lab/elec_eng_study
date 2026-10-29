"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { withinTolerance } from "@iea/circuit-sim";
import type { Lesson, Question } from "@/content/curriculum";
import { parseEngineering } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isCorrect(q: Question, answer: string | undefined): boolean {
  if (answer === undefined || answer === "") return false;
  if (q.kind === "single-choice") return answer === q.correct;
  const value = parseEngineering(answer);
  return value !== null && withinTolerance(value, q.answer, q.tolerance);
}

export function KnowledgeCheck({ lesson, onSubmit }: { lesson: Lesson; onSubmit: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const questions = lesson.knowledgeCheck.questions;
  const correct = questions.filter((q) => isCorrect(q, answers[q.id])).length;
  const score = correct / questions.length;
  const passed = score >= lesson.knowledgeCheck.passThreshold;

  const submit = () => {
    setSubmitted(true);
    onSubmit(score);
  };

  return (
    <div className="space-y-5" data-testid="knowledge-check">
      {questions.map((q, i) => {
        const right = isCorrect(q, answers[q.id]);
        return (
          <fieldset key={q.id} className="rounded-lg border border-border bg-card p-4" disabled={submitted}>
            <legend className="sr-only">Question {i + 1}</legend>
            <p className="text-sm font-medium">
              <span className="lcd mr-2 text-amber">Q{i + 1}</span>
              {q.prompt}
            </p>
            {q.kind === "single-choice" ? (
              <div className="mt-3 grid gap-2" role="radiogroup">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                      answers[q.id] === o.id ? "border-cyan/60 bg-cyan/5" : "border-border hover:bg-accent",
                      submitted && o.id === q.correct && "border-success/60 bg-success/10",
                    )}
                  >
                    <input type="radio" name={q.id} value={o.id} checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} className="accent-[var(--cyan)]" data-testid={`q-${q.id}-${o.id}`} />
                    {o.text}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex max-w-xs items-center gap-2">
                <Input aria-label={q.prompt} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} data-testid={`q-${q.id}-input`} />
                <span className="text-sm text-muted-foreground">{q.unit}</span>
              </div>
            )}
            {submitted && (
              <p className={cn("mt-3 flex gap-2 text-sm", right ? "text-success" : "text-danger")}>
                {right ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                <span className="text-muted-foreground">{q.explanation}</span>
              </p>
            )}
          </fieldset>
        );
      })}
      {!submitted ? (
        <Button onClick={submit} disabled={Object.keys(answers).length === 0} data-testid="submit-check">
          Submit answers
        </Button>
      ) : (
        <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4", passed ? "border-success/40 bg-success/10" : "border-amber/40 bg-amber/10")} data-testid="check-result">
          <div>
            <div className="font-medium">
              {Math.round(score * 100)} % — {passed ? "passed" : `${Math.round(lesson.knowledgeCheck.passThreshold * 100)} % needed to complete the lesson`}
            </div>
            <div className="text-sm text-muted-foreground">
              {correct} of {questions.length} correct.
            </div>
          </div>
          {!passed && (
            <Button
              variant="secondary"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
              }}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
