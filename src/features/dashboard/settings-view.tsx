"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useProgressStore } from "@/stores/progress-store";
import { useSettingsStore, type Settings } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Toggle({ label, description, checked, onChange, testId }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-cyan/60 bg-cyan/40" : "border-border bg-secondary")}
      >
        <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-foreground transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

export function SettingsView() {
  const settings = useSettingsStore();
  const progress = useProgressStore((s) => s.progress);
  const reset = useProgressStore((s) => s.reset);
  const importProgress = useProgressStore((s) => s.importProgress);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iea-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Motion</CardTitle>
          <CardDescription>Controls animated current flow and interface transitions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Reduced motion">
            {(
              [
                ["system", "Follow system"],
                ["reduce", "Reduce"],
                ["full", "Full motion"],
              ] as Array<[Settings["reducedMotion"], string]>
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={settings.reducedMotion === value}
                onClick={() => settings.update({ reducedMotion: value })}
                className={cn("rounded-md border px-3 py-2 text-sm", settings.reducedMotion === value ? "border-amber/60 bg-amber/10 text-amber" : "border-border hover:bg-accent")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">With reduced motion, current direction is shown with static arrows instead of moving dots.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulator display</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Toggle label="Terminal labels" description="Show T1–T18 next to the binding posts." checked={settings.showPostLabels} onChange={(v) => settings.update({ showPostLabels: v })} />
          <Toggle label="Component labels" description="Show part names and values above the parts." checked={settings.showPartLabels} onChange={(v) => settings.update({ showPartLabels: v })} />
          <Toggle label="Current flow" description="Visualize conventional current through conducting parts and leads." checked={settings.showCurrentFlow} onChange={(v) => settings.update({ showCurrentFlow: v })} />
          <Toggle label="Performance overlay" description="Frame rate, texture count, LOD and voxel statistics." checked={settings.showPerformance} onChange={(v) => settings.update({ showPerformance: v })} testId="toggle-performance" />
          <Toggle label="High-detail geometry" description="Allow the finest voxel bake when zoomed in (uses more memory)." checked={settings.maxDetail === 8} onChange={(v) => settings.update({ maxDetail: v ? 8 : 4 })} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Learning data</CardTitle>
          <CardDescription>
            Progress is saved in this browser&apos;s local storage ({progress.attempts.length} attempts, {Object.keys(progress.lessons).length} lessons, {progress.projects.length} saved circuits). Cloud sync is planned.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportProgress}>
            <Download /> Export progress
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload /> Import progress
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const result = importProgress(await file.text());
              setMessage(result.ok ? "Progress imported." : (result.error ?? "Import failed."));
              e.target.value = "";
            }}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" data-testid="reset-progress">
                Reset all progress
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset all progress?</DialogTitle>
                <DialogDescription>This permanently deletes lesson completions, challenge attempts and saved circuits from this browser. Export first if you want a copy.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    data-testid="confirm-reset"
                    onClick={() => {
                      reset();
                      setMessage("Progress reset.");
                    }}
                  >
                    Delete progress
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={settings.resetSettings}>
            Restore default settings
          </Button>
          {message && (
            <p role="status" className="w-full text-sm text-cyan">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
