"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { WORKSHOP_PRESETS, workshopScenario, type WorkshopPresetId } from "@/domain/bench/scenarios";
import { parseBenchState } from "@/domain/bench/schema";
import { createSession } from "@/domain/bench/session";
import { useBenchStore } from "@/stores/bench-store";
import { useProgressStore } from "@/stores/progress-store";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BenchWorkspace } from "./bench-workspace";
import { DeleteButton } from "./panels";

/**
 * Free-form bench: explore (simulator environment view) or workshop (with
 * saved projects). Uses the same engine and session model as challenges.
 */
export function SandboxRunner({ variant }: { variant: "explore" | "workshop" }) {
  const load = useBenchStore((s) => s.load);
  const restore = useBenchStore((s) => s.restore);
  const session = useBenchStore((s) => s.session);
  const scenario = useBenchStore((s) => s.scenario);
  const projects = useProgressStore((s) => s.progress.projects);
  const saveProject = useProgressStore((s) => s.saveProject);
  const deleteProject = useProgressStore((s) => s.deleteProject);
  const [preset, setPreset] = useState<WorkshopPresetId>("workshop-single");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    load(workshopScenario(preset));
  }, [preset, load]);

  const save = () => {
    if (!session) return;
    const projectName = name.trim() || `Circuit ${projects.length + 1}`;
    saveProject({
      id: `p-${Date.now()}`,
      name: projectName,
      savedAt: new Date().toISOString(),
      preset,
      bench: { ...session.state, supply: { ...session.state.supply, outputOn: false } },
    });
    setName("");
    setMessage(`Saved “${projectName}”. Saved circuits are stored with your progress in this browser.`);
  };

  const open = (id: string) => {
    const project = projects.find((p) => p.id === id);
    const state = project ? parseBenchState(project.bench) : null;
    if (!project || !state || !scenario) {
      setMessage("That saved circuit could not be loaded (it may be from an incompatible version).");
      return;
    }
    restore({ ...scenario, generator: project.preset as WorkshopPresetId, state }, createSession(state));
    setMessage(`Loaded “${project.name}”. The supply output starts OFF.`);
  };

  const panel = (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Circuit preset</h3>
        <div className="grid gap-2">
          {WORKSHOP_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              data-testid={`preset-${p.id}`}
              className={`rounded-md border p-3 text-left transition-colors hover:bg-accent ${preset === p.id ? "border-cyan/50 bg-accent" : "border-border"}`}
            >
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Every resistor can be replaced and the supply voltage adjusted. Select a part on the bench or in the Circuit tab.</p>
      </section>

      {variant === "workshop" ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Saved circuits</h3>
          <div className="space-y-1">
            <Label htmlFor="project-name">Name</Label>
            <div className="flex gap-2">
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My divider" data-testid="project-name" />
              <Button variant="secondary" onClick={save} data-testid="save-project">
                <Save /> Save
              </Button>
            </div>
          </div>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved circuits yet.</p>
          ) : (
            <ul className="space-y-1" data-testid="project-list">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                  <button className="flex flex-1 items-center gap-2 text-left hover:text-cyan" onClick={() => open(p.id)}>
                    <FolderOpen className="size-3.5" />
                    <span className="flex-1">{p.name}</span>
                    <span className="text-muted-foreground">{formatDate(p.savedAt)}</span>
                  </button>
                  <DeleteButton onClick={() => deleteProject(p.id)} label={`Delete ${p.name}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-2 text-sm text-muted-foreground">
          <p>This is the free exploration view of the training bench. Nothing here is scored.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/challenges">Challenges</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/workshop">Workshop (save circuits)</Link>
            </Button>
          </div>
        </section>
      )}
      {message && <p className="text-xs text-cyan" role="status">{message}</p>}
    </div>
  );

  return (
    <BenchWorkspace
      title={variant === "workshop" ? "Workshop" : "Electrical Training Bench"}
      subtitle={variant === "workshop" ? "Freeform engineering sandbox" : "Environment A · free exploration"}
      backHref={variant === "workshop" ? "/dashboard" : "/simulator"}
      backLabel={variant === "workshop" ? "Dashboard" : "Environments"}
      taskPanel={panel}
      taskLabel={variant === "workshop" ? "Workshop" : "Explore"}
    />
  );
}
