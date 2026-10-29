import type { Metadata } from "next";
import { SandboxRunner } from "@/features/bench/sandbox-runner";

export const metadata: Metadata = { title: "Workshop" };

export default function WorkshopPage() {
  return <SandboxRunner variant="workshop" />;
}
