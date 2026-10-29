import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ENVIRONMENTS } from "@/domain/environments";
import { SandboxRunner } from "@/features/bench/sandbox-runner";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return ENVIRONMENTS.map((e) => ({ environment: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ environment: string }> }): Promise<Metadata> {
  const { environment } = await params;
  return { title: ENVIRONMENTS.find((e) => e.id === environment)?.title ?? "Simulator" };
}

export default async function EnvironmentPage({ params }: { params: Promise<{ environment: string }> }) {
  const { environment } = await params;
  const env = ENVIRONMENTS.find((e) => e.id === environment);
  if (!env) notFound();
  if (env.status !== "available") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">{env.title} is not available yet</h1>
        <p className="max-w-md text-sm text-muted-foreground">This environment will open once its simulation capabilities exist: {env.requires}</p>
        <Button asChild variant="secondary">
          <Link href="/simulator">Back to environments</Link>
        </Button>
      </div>
    );
  }
  return <SandboxRunner variant="explore" />;
}
