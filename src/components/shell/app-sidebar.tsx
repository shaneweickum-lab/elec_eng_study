"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Box, Gauge, LayoutDashboard, Settings, Swords, TrendingUp, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeXp, levelFromXp } from "@/domain/progress/progress";
import { useProgressStore } from "@/stores/progress-store";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/academy", label: "Academy", icon: BookOpen },
  { href: "/simulator", label: "Simulator", icon: Box },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/workshop", label: "Workshop", icon: Wrench },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const progress = useProgressStore((s) => s.progress);
  const hydrated = useProgressStore((s) => s.hydrated);
  const xp = computeXp(progress);
  const level = levelFromXp(xp);
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/50 md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Logo className="size-7" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Industrial Engineering</div>
          <div className="text-[11px] tracking-widest text-muted-foreground uppercase">Academy</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("size-4", active && "text-cyan")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-md border border-border bg-background/40 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="size-3.5" /> Level {hydrated ? level.level : "–"}
          </span>
          <span className="lcd text-muted-foreground">{hydrated ? xp : "–"} XP</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-cyan/70" style={{ width: `${(level.current / level.next) * 100}%` }} />
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">XP tracks activity. Competency is tracked separately on the Progress page.</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card/60 px-2 py-2 md:hidden" aria-label="Main">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", pathname.startsWith(item.href) ? "bg-accent" : "text-muted-foreground")}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
