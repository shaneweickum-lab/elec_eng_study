import type { GlossaryEntry } from "@/content/curriculum/glossary";

/**
 * Splits curriculum text into plain, **bold** and glossary-term segments.
 *
 * Matching is whole-word and case-insensitive, except all-caps aliases
 * (acronyms such as PPE or SI), which must match exactly. Longer aliases win
 * ("arc flash" before "flash"). Each term is linked only on its first
 * occurrence within the shared `seen` set, so a section is not cluttered with
 * repeated underlines.
 */
export type Segment = { kind: "text"; text: string } | { kind: "term"; text: string; termId: string };
export interface RichPart {
  bold: boolean;
  segments: Segment[];
}

interface Matcher {
  regex: RegExp;
  lookup: Map<string, string>; // normalized alias → term id
}

const isAcronym = (alias: string) => /^[A-Z0-9 ]+$/.test(alias) && /[A-Z]/.test(alias);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const key = (alias: string) => (isAcronym(alias) ? `=${alias}` : alias.toLowerCase());

const cache = new WeakMap<readonly GlossaryEntry[], Matcher>();

function matcherFor(glossary: readonly GlossaryEntry[]): Matcher {
  const cached = cache.get(glossary);
  if (cached) return cached;
  const lookup = new Map<string, string>();
  const aliases: string[] = [];
  for (const entry of glossary) {
    for (const alias of entry.aliases) {
      lookup.set(key(alias), entry.id);
      aliases.push(alias);
    }
  }
  aliases.sort((a, b) => b.length - a.length);
  // Case-insensitive overall; acronyms are re-checked for exact case after matching.
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_-])(${aliases.map(escape).join("|")})(?![\\p{L}\\p{N}_-])`, "giu");
  const matcher = { regex, lookup };
  cache.set(glossary, matcher);
  return matcher;
}

function resolve(match: string, lookup: Map<string, string>): string | undefined {
  return lookup.get(`=${match}`) ?? lookup.get(match.toLowerCase());
}

export function annotateTerms(text: string, glossary: readonly GlossaryEntry[], seen: Set<string>): Segment[] {
  const { regex, lookup } = matcherFor(glossary);
  const segments: Segment[] = [];
  let last = 0;
  regex.lastIndex = 0;
  for (const m of text.matchAll(regex)) {
    const matched = m[0];
    const id = resolve(matched, lookup);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (m.index > last) segments.push({ kind: "text", text: text.slice(last, m.index) });
    segments.push({ kind: "term", text: matched, termId: id });
    last = m.index + matched.length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

/** Split **bold** markup, then annotate each piece in reading order. */
export function parseRichText(text: string, glossary: readonly GlossaryEntry[], seen: Set<string> | null): RichPart[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p.length > 0)
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      const body = bold ? part.slice(2, -2) : part;
      return { bold, segments: seen ? annotateTerms(body, glossary, seen) : [{ kind: "text" as const, text: body }] };
    });
}

/** Strip markup for attributes such as aria-label. */
export function plainText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}
