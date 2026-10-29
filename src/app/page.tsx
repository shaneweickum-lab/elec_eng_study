import Link from "next/link";
import { ArrowRight, BookOpen, Box, Gauge, ShieldCheck, Stethoscope, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";

const LOOP = [
  { title: "Learn", text: "Structured, versioned lessons with worked examples.", icon: BookOpen },
  { title: "Observe", text: "Watch the same solver drive every reading and display.", icon: Gauge },
  { title: "Practice", text: "Change real circuit parameters on the bench.", icon: Box },
  { title: "Diagnose", text: "Find seeded faults with proper measurement technique.", icon: Stethoscope },
  { title: "Demonstrate", text: "Evidence-based mastery, scored safely.", icon: Target },
];

export default function LandingPage() {
  return (
    <div className="bg-grid min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo className="size-8" />
          <span className="text-sm font-semibold tracking-wide">Industrial Engineering Academy</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/academy">Academy</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/simulator">Simulator</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> Tier 1 electrical laboratory — first release
          </div>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight md:text-6xl">
            Industrial electrical maintenance,
            <span className="text-cyan"> learned on the bench.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Study the theory, then prove it in an isometric electrical laboratory where every voltage, current and fault comes from a real circuit solver — and where unsafe technique is noticed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/academy/lesson/ohms-law">
                Start with Ohm&apos;s law <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/simulator/training-bench">Enter the training bench</Link>
            </Button>
          </div>
        </div>

        <ol className="mt-20 grid gap-3 md:grid-cols-5">
          {LOOP.map((step, i) => (
            <li key={step.title} className="relative rounded-lg border border-border bg-card/80 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="lcd text-amber">0{i + 1}</span>
                <step.icon className="size-4 text-cyan" />
              </div>
              <div className="mt-3 font-medium">{step.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex items-start gap-3 rounded-lg border border-amber/30 bg-amber/5 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber" />
          <p>
            Virtual training builds understanding; it does not authorize work on energized equipment. Tier labels are this platform&apos;s provisional curriculum categories and are not aligned to any
            employer&apos;s examination until official competency requirements are mapped.
          </p>
        </div>
      </main>
    </div>
  );
}
