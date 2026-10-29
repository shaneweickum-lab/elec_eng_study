import { GLOSSARY } from "@/content/curriculum/glossary";
import type { Block, Lesson } from "@/content/curriculum";
import { parseRichText, type RichPart } from "@/lib/glossary-match";

/** Texts of a block in reading order (the ones rendered through RichText). */
function blockTexts(block: Block): string[] {
  switch (block.type) {
    case "text":
    case "callout":
      return [block.body];
    case "list":
      return block.items;
    case "table":
      return block.rows.flat();
    default:
      return [];
  }
}

export interface LessonAnnotations {
  /** Per section: text → annotated parts (first occurrence of each term in the section). */
  sections: Map<string, Map<string, RichPart[]>>;
  /** Glossary term ids used anywhere in the lesson, in order of first appearance. */
  termIds: string[];
}

export function annotateLesson(lesson: Lesson): LessonAnnotations {
  const sections = new Map<string, Map<string, RichPart[]>>();
  const all: string[] = [];
  for (const section of lesson.sections) {
    const seen = new Set<string>();
    const map = new Map<string, RichPart[]>();
    for (const text of section.blocks.flatMap(blockTexts)) {
      if (!map.has(text)) map.set(text, parseRichText(text, GLOSSARY, seen));
    }
    for (const id of seen) if (!all.includes(id)) all.push(id);
    sections.set(section.id, map);
  }
  return { sections, termIds: all };
}
