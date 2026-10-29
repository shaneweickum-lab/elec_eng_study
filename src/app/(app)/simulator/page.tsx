import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { ENVIRONMENTS } from "@/domain/environments";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Simulator" };

export default function SimulatorPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Industrial Simulator"
        title="Simulation environments"
        description="Isometric laboratories built from procedurally generated equipment. Every reading is computed by the circuit engine from the state of the equipment."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ENVIRONMENTS.map((env) => (
          <Card key={env.id} className={env.status === "planned" ? "border-dashed bg-card/40" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="lcd text-xs text-amber">ENVIRONMENT {env.code}</span>
                {env.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="outline"><Lock /> Planned</Badge>}
              </div>
              <CardTitle className="text-lg">{env.title}</CardTitle>
              <CardDescription>{env.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Requires: {env.requires}</p>
              {env.status === "available" && (
                <Button asChild>
                  <Link href={`/simulator/${env.id}`} data-testid={`env-${env.id}`}>
                    Enter laboratory <ArrowRight />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
