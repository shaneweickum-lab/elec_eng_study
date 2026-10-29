import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="bg-grid flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="lcd text-5xl text-amber">OL</div>
      <h1 className="text-xl font-semibold">Open circuit — page not found</h1>
      <p className="text-sm text-muted-foreground">There is no conductive path to the page you requested.</p>
      <Button asChild>
        <Link href="/dashboard">Back to the dashboard</Link>
      </Button>
    </div>
  );
}
