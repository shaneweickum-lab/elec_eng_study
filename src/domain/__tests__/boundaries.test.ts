import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Architectural guard: engine packages must stay framework-independent. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith(".ts") ? [full] : [];
  });
}

const root = path.resolve(import.meta.dirname, "../../..");
const FORBIDDEN = /from\s+["'](react|react-dom|next|pixi\.js|@supabase\/[^"']+|zustand)["']/;

describe("package boundaries", () => {
  for (const pkg of ["circuit-sim", "voxel-engine"]) {
    it(`@iea/${pkg} imports no UI, rendering or persistence frameworks`, () => {
      for (const file of files(path.join(root, "packages", pkg, "src"))) {
        expect(readFileSync(file, "utf8"), file).not.toMatch(FORBIDDEN);
      }
    });
  }
  it("domain logic does not import React or PixiJS", () => {
    for (const file of files(path.join(root, "src", "domain"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["'](react|pixi\.js)["']/);
    }
  });
});
