import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FUTURE_PATHWAYS, PATHWAYS } from "@/content/curriculum";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Academy" };

export default function AcademyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="The Academy"
        title="Learning pathways"
        description="Structured lessons, demonstrations and knowledge checks, each connected to simulator challenges. Tiers are provisional curriculum categories, not aligned to any employer's examination."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {PATHWAYS.map((p) => {
          const available = p.modules.filter((m) => m.status === "available").length;
          return (
            <Link key={p.id} href={p.href} className="group">
              <Card className="h-full transition-colors group-hover:border-cyan/40">
                <CardHeader>
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-cyan uppercase">{p.subtitle}</div>
                  <CardTitle className="text-lg">{p.title}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {p.modules.length} modules · {available} available now
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-muted-foreground">Future pathways</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {FUTURE_PATHWAYS.map((f) => (
            <Badge key={f} variant="outline">
              {f}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
