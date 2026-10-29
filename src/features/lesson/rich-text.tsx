"use client";

import { createContext, Fragment, useContext } from "react";
import { GLOSSARY } from "@/content/curriculum/glossary";
import { parseRichText, type RichPart } from "@/lib/glossary-match";
import { GlossaryTerm } from "./glossary-term";

/**
 * Looks up pre-annotated text for the current lesson section, so each glossary
 * term is linked once per section in reading order.
 */
export const AnnotationContext = createContext<((text: string) => RichPart[] | undefined) | null>(null);

function Segments({ part }: { part: RichPart }) {
  return (
    <>
      {part.segments.map((s, i) =>
        s.kind === "term" ? (
          <GlossaryTerm key={i} termId={s.termId}>
            {s.text}
          </GlossaryTerm>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Curriculum text: **bold** plus glossary tooltips. */
export function RichText({ text, glossary = true }: { text: string; glossary?: boolean }) {
  const lookup = useContext(AnnotationContext);
  const parts = (glossary ? lookup?.(text) : undefined) ?? parseRichText(text, GLOSSARY, glossary ? new Set() : null);
  return (
    <>
      {parts.map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            <Segments part={part} />
          </strong>
        ) : (
          <Segments key={i} part={part} />
        ),
      )}
    </>
  );
}
