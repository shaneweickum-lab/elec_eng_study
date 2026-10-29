import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsView } from "@/features/dashboard/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Preferences" description="Display, motion and data settings. Everything is stored in this browser." />
      <SettingsView />
    </div>
  );
}
