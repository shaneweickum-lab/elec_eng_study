import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/curriculum/glossary";
import { LESSONS } from "@/content/curriculum";
import { annotateTerms, parseRichText } from "./glossary-match";

const terms = (text: string, seen = new Set<string>()) =>
  annotateTerms(text, GLOSSARY, seen)
    .filter((s) => s.kind === "term")
    .map((s) => (s.kind === "term" ? `${s.text}→${s.termId}` : ""));

describe("glossary", () => {
  it("has unique ids and aliases", () => {
    const ids = GLOSSARY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const aliases = GLOSSARY.flatMap((g) => g.aliases.map((a) => a.toLowerCase()));
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("matches whole words case-insensitively, preserving the original text", () => {
    expect(terms("An Ammeter is placed in series.")).toEqual(["Ammeter→ammeter", "in series→series"]);
  });

  it("prefers the longest alias", () => {
    expect(terms("Put the equipment in an electrically safe work condition.")).toEqual(["electrically safe work condition→electrically-safe-work-condition"]);
    expect(terms("Install a circuit breaker.")).toEqual(["circuit breaker→breaker"]);
  });

  it("does not match inside other words", () => {
    expect(terms("discharge the capacitors; raised loads; overloaded")).toEqual(["capacitors→capacitor"]);
  });

  it("requires exact case for acronyms", () => {
    expect(terms("Wear PPE.")).toEqual(["PPE→ppe"]);
    expect(terms("si señor, ppe")).toEqual([]);
  });

  it("links only the first occurrence within a shared scope", () => {
    const seen = new Set<string>();
    expect(terms("A fuse opens. The fuse is replaced.", seen)).toEqual(["fuse→fuse"]);
    expect(terms("Check the fuse again.", seen)).toEqual([]);
  });

  it("annotates inside bold text", () => {
    const parts = parseRichText("**Arc flash** — heat and light.", GLOSSARY, new Set());
    expect(parts[0]).toEqual({ bold: true, segments: [{ kind: "term", text: "Arc flash", termId: "arc-flash" }] });
  });

  it("finds specialist terms in every authored lesson", () => {
    for (const lesson of LESSONS) {
      const seen = new Set<string>();
      const text = lesson.sections.flatMap((s) => s.blocks).map((b) => JSON.stringify(b)).join(" ");
      annotateTerms(text, GLOSSARY, seen);
      expect(seen.size, lesson.slug).toBeGreaterThanOrEqual(10);
    }
  });
});
