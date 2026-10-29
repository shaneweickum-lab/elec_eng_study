"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Lightbulb, Lock, ShieldCheck, ShieldX, Target, XCircle } from "lucide-react";
import { formatQuantity } from "@iea/circuit-sim";
import { generateScenario } from "@/domain/bench/scenarios";
import { evaluateChallenge, type ChallengeResult } from "@/domain/challenges/evaluate";
import type { ChallengeDefinition, ChallengeMode, ChallengeTask } from "@/domain/challenges/schema";
import { CHALLENGES } from "@/domain/challenges/definitions";
import { challengeLockReasons } from "@/domain/progress/progress";
import { newSeed } from "@/lib/random";
import { parseEngineering } from "@/lib/units";
import { cn, formatDuration } from "@/lib/utils";
import { useBenchStore } from "@/stores/bench-store";
import { useProgressStore } from "@/stores/progress-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BenchWorkspace } from "./bench-workspace";

const MODES: Array<{ id: ChallengeMode; title: string; description: string }> = [
  { id: "guided", title: "Guided practice", description: "Hints are free and task status updates live. Builds familiarity; does not count toward proficiency." },
  { id: "independent", title: "Independent", description: "Solve it yourself. Hints are available but cost points." },
  { id: "timed", title: "Timed assessment", description: "Independent rules with a time limit." },
  { id: "mastery", title: "Mastery assessment", description: "A fresh unseen scenario, no hints, timed. Required for “mastered”." },
];

interface Attempt {
  mode: ChallengeMode;
  seed: number;
  startedAt: string;
  startedMs: number;
  hintsRevealed: number;
  wrongDiagnoses: number;
  confirmedDiagnosis: string | null;
  answers: Record<string, string>;
  result: ChallengeResult | null;
}

export function ChallengeRunner({ challenge }: { challenge: ChallengeDefinition }) {
  const hydrated = useProgressStore((s) => s.hydrated);
  const progress = useProgressStore((s) => s.progress);
  const addAttempt = useProgressStore((s) => s.addAttempt);
  const load = useBenchStore((s) => s.load);
  const session = useBenchStore((s) => s.session);
  const scenario = useBenchStore((s) => s.scenario);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const locks = hydrated ? challengeLockReasons(progress, challenge) : [];

  const start = useCallback(
    (mode: ChallengeMode, seed?: number) => {
      const s = seed ?? newSeed();
      load(generateScenario(challenge.scenario.generator, s));
      setAttempt({ mode, seed: s, startedAt: new Date().toISOString(), startedMs: Date.now(), hintsRevealed: mode === "guided" ? 1 : 0, wrongDiagnoses: 0, confirmedDiagnosis: null, answers: {}, result: null });
    },
    [challenge, load],
  );

  // Show an idle bench (seeded preview) behind the start dialog.
  useEffect(() => {
    load(generateScenario(challenge.scenario.generator, 1));
  }, [challenge, load]);

  useEffect(() => {
    if (!attempt || attempt.result) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [attempt]);

  const elapsed = attempt ? (now - attempt.startedMs) / 1000 : 0;
  const timed = attempt && (attempt.mode === "timed" || attempt.mode === "mastery");
  const remaining = timed ? challenge.scoring.timeLimitSeconds - elapsed : null;

  const submit = useCallback(() => {
    if (!attempt || !session || !scenario || attempt.result) return;
    const answers: Record<string, number | undefined> = {};
    for (const [id, text] of Object.entries(attempt.answers)) answers[id] = parseEngineering(text) ?? undefined;
    const durationSeconds = (Date.now() - attempt.startedMs) / 1000;
    const result = evaluateChallenge(challenge, {
      state: session.state,
      facts: scenario.facts,
      readings: session.readings,
      safetyEvents: session.safetyEvents,
      answers,
      diagnosis: attempt.confirmedDiagnosis ?? attempt.answers.__diagnosis,
      wrongDiagnoses: attempt.wrongDiagnoses,
      hintsUsed: attempt.mode === "guided" ? 0 : attempt.hintsRevealed,
      mode: attempt.mode,
      elapsedSeconds: durationSeconds,
    });
    addAttempt({
      id: `${challenge.id}-${attempt.seed}-${Date.now()}`,
      challengeId: challenge.id,
      definitionVersion: challenge.version,
      seed: attempt.seed,
      mode: attempt.mode,
      startedAt: attempt.startedAt,
      submittedAt: new Date().toISOString(),
      durationSeconds,
      hintsUsed: attempt.hintsRevealed,
      passed: result.passed,
      score: result.score,
      safetyScore: result.safetyScore,
      safetyPassed: result.safetyPassed,
      actions: session.actions.map((a) => ({ ...a })),
      answers: Object.fromEntries(Object.entries(attempt.answers).filter(([k]) => k !== "__diagnosis")),
      diagnosis: attempt.confirmedDiagnosis ?? attempt.answers.__diagnosis,
      wrongDiagnoses: attempt.wrongDiagnoses,
      readings: session.readings.length,
      safetyCodes: session.safetyEvents.map((e) => e.code),
    });
    setAttempt({ ...attempt, result });
  }, [attempt, session, scenario, challenge, addAttempt]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && attempt && !attempt.result) submit();
  }, [remaining, attempt, submit]);

  const next = useMemo(() => [...CHALLENGES].sort((a, b) => a.order - b.order).find((c) => c.order > challenge.order), [challenge]);

  const header = attempt && (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="secondary">{MODES.find((m) => m.id === attempt.mode)?.title}</Badge>
      <span className={cn("lcd flex items-center gap-1", remaining !== null && remaining < 60 ? "text-danger" : "text-muted-foreground")} data-testid="attempt-timer">
        <Clock className="size-3.5" />
        {remaining !== null ? formatDuration(Math.max(0, remaining)) : formatDuration(elapsed)}
      </span>
    </div>
  );

  const overlay = !attempt ? (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-popover p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Challenge {challenge.order}</Badge>
          <span>Difficulty {challenge.difficulty} / 5</span>
          <span>· definition v{challenge.version}</span>
        </div>
        <h2 className="mt-3 text-xl font-semibold">{challenge.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{challenge.summary}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {challenge.briefing.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-cyan" />
              {line}
            </li>
          ))}
        </ul>
        {!hydrated ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading your progress…</p>
        ) : locks.length > 0 ? (
          <div className="mt-6 rounded-md border border-amber/40 bg-amber/10 p-4 text-sm" data-testid="challenge-locked">
            <div className="flex items-center gap-2 font-medium text-amber">
              <Lock className="size-4" /> Locked
            </div>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {locks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href={challenge.prerequisites.lessons[0] ? `/academy/lesson/${challenge.prerequisites.lessons[0]}` : "/challenges"}>Go to prerequisite</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => start(m.id)}
                data-testid={`start-${m.id}`}
                className="rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-cyan/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="text-sm font-medium">{m.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>
                {(m.id === "timed" || m.id === "mastery") && <div className="mt-1 text-[11px] text-amber">Limit {formatDuration(challenge.scoring.timeLimitSeconds)}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const taskPanel =
    attempt && session && scenario ? (
      attempt.result ? (
        <ResultPanel
          challenge={challenge}
          attempt={attempt}
          result={attempt.result}
          next={next}
          onRetrySame={() => start(attempt.mode, attempt.mode === "mastery" ? undefined : attempt.seed)}
          onNewScenario={() => start(attempt.mode)}
        />
      ) : (
        <TaskPanel challenge={challenge} attempt={attempt} setAttempt={setAttempt} onSubmit={submit} facts={scenario.facts} />
      )
    ) : (
      <p className="text-sm text-muted-foreground">Choose a mode to begin.</p>
    );

  return (
    <BenchWorkspace
      title={challenge.title}
      subtitle={attempt ? `Scenario seed ${attempt.seed} · definition v${challenge.version}` : challenge.summary}
      backHref="/challenges"
      backLabel="Challenges"
      headerExtra={header}
      taskPanel={taskPanel}
      taskLabel="Challenge"
      overlay={overlay}
    />
  );
}

function liveTaskStatus(task: ChallengeTask): boolean | null {
  const session = useBenchStore.getState().session;
  if (!session) return null;
  if (task.kind === "evidence") {
    return session.readings.filter((r) => (task.modes as string[]).includes(r.mode) && r.status === "ok" && r.hazardCodes.length === 0).length >= task.minReadings;
  }
  if (task.kind === "measurement") {
    const spec = task.measurement;
    return session.readings.some((r) => {
      if (r.status !== "ok" || r.hazardCodes.length > 0) return false;
      if (task.requireCurrentRevision && r.revision !== session.state.revision) return false;
      if (spec.mode === "dc-voltage") return r.mode === "dc-voltage" && r.acrossParts.includes(spec.across);
      if (spec.mode === "dc-current") return r.mode === "dc-current" && r.seriesParts.includes(spec.through === "supply" ? session.state.supply.id : spec.through);
      return (r.mode === "resistance" || r.mode === "continuity") && r.acrossParts.includes(spec.of);
    });
  }
  return null;
}

function TaskPanel({
  challenge,
  attempt,
  setAttempt,
  onSubmit,
  facts,
}: {
  challenge: ChallengeDefinition;
  attempt: Attempt;
  setAttempt: (a: Attempt) => void;
  onSubmit: () => void;
  facts: Readonly<Record<string, number>>;
}) {
  const session = useBenchStore((s) => s.session);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<string | null>(null);
  const guided = attempt.mode === "guided";
  const hintsAllowed = attempt.mode !== "mastery";
  const parts = session?.state.parts ?? [];
  const setAnswer = (id: string, value: string) => setAttempt({ ...attempt, answers: { ...attempt.answers, [id]: value } });

  const checkDiagnosis = () => {
    const choice = attempt.answers.__diagnosis;
    if (!choice || !session) return;
    if (session.state.fault?.partId === choice) {
      setAttempt({ ...attempt, confirmedDiagnosis: choice });
      setDiagnosisFeedback("Diagnosis recorded.");
    } else {
      setAttempt({ ...attempt, wrongDiagnoses: attempt.wrongDiagnoses + 1 });
      setDiagnosisFeedback(`That is not the open component (−${challenge.scoring.wrongDiagnosisPenalty} points). Gather more evidence.`);
    }
  };

  return (
    <div className="space-y-5" data-testid="task-panel">
      <div className="space-y-1.5 text-sm">
        {challenge.briefing.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
      </div>

      <ol className="space-y-3">
        {challenge.tasks.map((task, i) => {
          const status = guided ? liveTaskStatus(task) : null;
          return (
            <li key={task.id} className="rounded-md border border-border bg-background/40 p-3">
              <div className="flex items-start gap-2 text-sm font-medium">
                {status === true ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <span>
                  {i + 1}. {task.prompt}
                </span>
              </div>
              {task.kind === "numeric-answer" && (
                <div className="mt-2 flex items-center gap-2 pl-6">
                  <Label htmlFor={`answer-${task.id}`} className="sr-only">
                    {task.prompt}
                  </Label>
                  <Input
                    id={`answer-${task.id}`}
                    data-testid={`answer-${task.id}`}
                    placeholder={task.unit === "A" ? "e.g. 0.05 or 50m" : task.unit === "Ω" ? "e.g. 1500 or 1.5k" : "e.g. 12"}
                    value={attempt.answers[task.id] ?? ""}
                    onChange={(e) => setAnswer(task.id, e.target.value)}
                  />
                  <span className="w-6 text-sm text-muted-foreground">{task.unit}</span>
                </div>
              )}
              {task.kind === "circuit-target" && facts[task.targetFact] !== undefined && (
                <p className="mt-2 flex items-center gap-1.5 pl-6 text-sm text-cyan">
                  <Target className="size-4" /> Target {formatQuantity(facts[task.targetFact]!, task.unit)} ± {task.tolerance * 100} %
                </p>
              )}
              {task.kind === "evidence" && (
                <p className="mt-1 pl-6 text-xs text-muted-foreground">{session?.readings.length ?? 0} readings logged so far.</p>
              )}
              {task.kind === "identify-fault" && (
                <div className="mt-2 space-y-2 pl-6">
                  <div className="flex gap-2">
                    <select
                      aria-label="Suspected open component"
                      data-testid="diagnosis-select"
                      disabled={attempt.confirmedDiagnosis !== null}
                      value={attempt.confirmedDiagnosis ?? attempt.answers.__diagnosis ?? ""}
                      onChange={(e) => setAnswer("__diagnosis", e.target.value)}
                      className="h-9 flex-1 rounded-md border border-input bg-background/60 px-2 text-sm"
                    >
                      <option value="">Select component…</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={checkDiagnosis} disabled={!attempt.answers.__diagnosis || attempt.confirmedDiagnosis !== null} data-testid="check-diagnosis">
                      Confirm
                    </Button>
                  </div>
                  {diagnosisFeedback && <p className={cn("text-xs", attempt.confirmedDiagnosis ? "text-success" : "text-amber")}>{diagnosisFeedback}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {hintsAllowed && challenge.hints.length > 0 && (
        <div className="space-y-2">
          {challenge.hints.slice(0, attempt.hintsRevealed).map((h) => (
            <p key={h.id} className="flex gap-2 rounded-md border border-cyan/20 bg-cyan/5 p-2 text-xs text-foreground/90">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cyan" />
              {h.text}
            </p>
          ))}
          {attempt.hintsRevealed < challenge.hints.length && (
            <Button variant="ghost" size="sm" onClick={() => setAttempt({ ...attempt, hintsRevealed: attempt.hintsRevealed + 1 })} data-testid="reveal-hint">
              <Lightbulb /> Reveal hint {guided ? "" : `(−${challenge.scoring.hintPenalty} points)`}
            </Button>
          )}
        </div>
      )}

      <Button className="w-full" onClick={onSubmit} data-testid="submit-challenge">
        Submit for evaluation
      </Button>
      <p className="text-[11px] text-muted-foreground">Results are checked against the simulator's solution of your circuit and your logged readings. Safety is scored separately.</p>
    </div>
  );
}

function ResultPanel({
  challenge,
  attempt,
  result,
  next,
  onRetrySame,
  onNewScenario,
}: {
  challenge: ChallengeDefinition;
  attempt: Attempt;
  result: ChallengeResult;
  next?: ChallengeDefinition;
  onRetrySame: () => void;
  onNewScenario: () => void;
}) {
  return (
    <div className="space-y-5" data-testid="challenge-result">
      <div className={cn("rounded-md border p-4", result.passed ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10")}>
        <div className="flex items-center gap-2 font-semibold">
          {result.passed ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-danger" />}
          <span data-testid="result-status">{result.passed ? "Passed" : "Not yet"}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md bg-background/50 p-2">
            <div className="lcd text-2xl" data-testid="result-score">
              {result.score}
            </div>
            <div className="text-[11px] text-muted-foreground">Technical score</div>
          </div>
          <div className="rounded-md bg-background/50 p-2">
            <div className={cn("lcd text-2xl", result.safetyPassed ? "text-success" : "text-danger")} data-testid="result-safety">
              {result.safetyScore}
            </div>
            <div className="text-[11px] text-muted-foreground">Safety score</div>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {challenge.tasks.map((task) => {
          const r = result.tasks.find((t) => t.taskId === task.id);
          return (
            <li key={task.id} className="flex gap-2 text-sm">
              {r?.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
              <div>
                <div>{task.prompt}</div>
                <div className="text-xs text-muted-foreground">{r?.feedback}</div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {result.safetyPassed ? <ShieldCheck className="size-4 text-success" /> : <ShieldX className="size-4 text-danger" />}
          {result.safetyPassed ? "No safety violations" : "Safety rules were broken"}
        </div>
        {result.safety.map((f) => (
          <p key={f.code} className={cn("rounded-md border p-2 text-xs", f.severity === "violation" ? "border-danger/40 text-danger" : "border-amber/40 text-amber")}>
            {f.message} {f.count > 1 && `(×${f.count})`}
          </p>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {result.passed && result.safetyPassed
          ? attempt.mode === "guided"
            ? "Guided passes show progress but do not count toward proficiency. Try Independent mode next."
            : "This attempt counts as evidence toward the challenge's skills."
          : "Only passed attempts with no safety violations count as competency evidence."}
      </p>

      <div className="grid gap-2">
        {attempt.mode !== "mastery" && (
          <Button variant="secondary" onClick={onRetrySame} data-testid="retry-same">
            Retry this scenario
          </Button>
        )}
        <Button variant="secondary" onClick={onNewScenario} data-testid="retry-new">
          New scenario
        </Button>
        {result.passed && next && (
          <Button asChild>
            <Link href={`/challenges/${next.id}`}>Next: {next.title}</Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/progress">View progress</Link>
        </Button>
      </div>
    </div>
  );
}
