"use client";

import { useState } from "react";
import { getGlossaryEntry } from "@/content/curriculum/glossary";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A term with a definition tooltip. Opens on hover, keyboard focus, or tap
 * (touch screens have no hover), and closes with Escape or by tapping elsewhere.
 */
export function GlossaryTerm({ termId, children }: { termId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = getGlossaryEntry(termId);
  if (!entry) return <>{children}</>;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-glossary={entry.id}
          onClick={(e) => {
            // Radix closes tooltips on trigger click; for terms a click/tap should show the definition.
            e.preventDefault();
            setOpen(true);
          }}
          className="cursor-help rounded-sm text-inherit underline decoration-cyan/60 decoration-dotted underline-offset-4 hover:decoration-cyan focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3 text-left leading-relaxed" data-testid={`glossary-tip-${entry.id}`}>
        <div className="mb-1 text-xs font-semibold text-cyan">{entry.term}</div>
        <p className="text-xs text-popover-foreground/90">{entry.definition}</p>
      </TooltipContent>
    </Tooltip>
  );
}
