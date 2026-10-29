import { describe, expect, it } from "vitest";
import {
  VoxelGrid,
  bakeAsset,
  assetKey,
  clearAssetCaches,
  createAsset,
  createElectricalCabinet,
  hashString,
  isoProject,
  isoUnproject,
  rasterize,
  registeredAssetTypes,
  resistorColorCode,
  M,
} from "../src";

const checksum = (pixels: Uint8ClampedArray) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < pixels.length; i++) h = Math.imul(h ^ pixels[i]!, 0x01000193);
  return h >>> 0;
};

describe("projection", () => {
  it("follows the documented 2:1 isometric formula", () => {
    expect(isoProject({ x: 1, y: 0, z: 0 }, 2)).toEqual({ x: 2, y: 1 });
    expect(isoProject({ x: 0, y: 1, z: 0 }, 2)).toEqual({ x: -2, y: 1 });
    expect(isoProject({ x: 0, y: 0, z: 1 }, 2)).toEqual({ x: 0, y: -2 });
  });
  it("inverts on a ground plane", () => {
    const p = { x: 12.5, y: 7.25, z: 3 };
    const back = isoUnproject(isoProject(p, 4), 4, 3);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
});

describe("rasterizer", () => {
  it("eliminates hidden faces of interior voxels", () => {
    const g = new VoxelGrid(8, 8, 8).box(0, 0, 0, 8, 8, 8, M.steel);
    const img = rasterize(g, { unit: 2 });
    expect(img.stats.solidVoxels).toBe(512);
    // Only voxels on the three visible faces can be seen: 512 − 7³.
    expect(img.stats.visibleVoxels).toBe(512 - 343);
    expect(img.stats.facesDrawn).toBe(3 * 64);
  });

  it("produces a watertight silhouette for a solid cube (no transparent holes)", () => {
    const g = new VoxelGrid(6, 6, 6).box(0, 0, 0, 6, 6, 6, M.steel);
    const img = rasterize(g, { unit: 4, outline: false });
    // Sample the center column of the image: everything between the top and bottom of the cube must be opaque.
    const x = img.originX; // projection of the x = y line
    let first = -1;
    let last = -1;
    for (let y = 0; y < img.height; y++) {
      if (img.pixels[(y * img.width + x) * 4 + 3]! > 0) {
        if (first < 0) first = y;
        last = y;
      }
    }
    for (let y = first; y <= last; y++) expect(img.pixels[(y * img.width + x) * 4 + 3]).toBe(255);
  });

  it("rejects odd units", () => {
    expect(() => rasterize(new VoxelGrid(1, 1, 1), { unit: 3 })).toThrow();
  });

  it("draws nearer voxels over farther ones", () => {
    const g = new VoxelGrid(2, 1, 1);
    g.set(0, 0, 0, M.jackRed);
    g.set(1, 0, 0, M.jackGreen); // in front along +x
    const img = rasterize(g, { unit: 4, outline: false });
    // The shared vertical edge belongs to the front (green) voxel's left face.
    const p = { x: img.originX + 4, y: img.originY + 2 };
    const o = (p.y * img.width + p.x) * 4;
    expect(img.pixels[o + 1]!).toBeGreaterThan(img.pixels[o]!);
  });
});

describe("procedural assets", () => {
  it("registers the core industrial asset types", () => {
    expect(registeredAssetTypes()).toEqual(
      expect.arrayContaining(["workbench", "bench-power-supply", "terminal-board", "resistor", "knife-switch", "multimeter", "electrical-cabinet", "floor-tile"]),
    );
  });

  it("is deterministic: identical definitions bake identical pixels", () => {
    const def = { type: "bench-power-supply", params: { outputOn: true } };
    const a = checksum(bakeAsset(def, 4).image.pixels);
    clearAssetCaches();
    const b = checksum(bakeAsset(def, 4).image.pixels);
    expect(a).toBe(b);
  });

  it("keys assets by type, version and parameters", () => {
    expect(assetKey({ type: "knife-switch", params: { closed: true } })).not.toBe(assetKey({ type: "knife-switch", params: { closed: false } }));
    expect(assetKey({ type: "knife-switch", params: { closed: true, axis: "x" } })).toBe(assetKey({ type: "knife-switch", params: { axis: "x", closed: true } }));
    expect(assetKey({ type: "resistor" })).toMatch(/^resistor@1#/);
  });

  it("state changes change the bake", () => {
    const on = checksum(bakeAsset({ type: "knife-switch", params: { closed: true } }, 2).image.pixels);
    const off = checksum(bakeAsset({ type: "knife-switch", params: { closed: false } }, 2).image.pixels);
    expect(on).not.toBe(off);
  });

  it("exposes electrical terminal metadata", () => {
    const board = createAsset({ type: "terminal-board", params: { cols: 4, rows: 2 } });
    expect(board.attachments.filter((a) => a.kind === "terminal")).toHaveLength(8);
    const supply = createAsset({ type: "bench-power-supply" });
    expect(supply.attachments.find((a) => a.id === "jack-positive")?.meta?.polarity).toBe("+");
    expect(supply.hotspots.map((h) => h.id)).toContain("output-button");
  });

  it("supports the createElectricalCabinet API", () => {
    const closed = createElectricalCabinet({ width: 32, depth: 18, height: 52, doorState: "closed", components: [] });
    const open = createElectricalCabinet({ width: 32, depth: 18, height: 52, doorState: "open", components: [{ kind: "contactor", x: 2, z: 0 }] });
    expect(closed.grid.depth).toBe(18);
    expect(open.grid.depth).toBeGreaterThan(18);
    expect(open.grid.count()).not.toBe(closed.grid.count());
  });

  it("pixel hit-testing matches the alpha mask", () => {
    const baked = bakeAsset({ type: "test-probe" }, 4);
    const tip = baked.attachmentPixels.tip!;
    expect(baked.hitTest(tip.x, tip.y - 2)).toBe(true);
    expect(baked.hitTest(0, 0)).toBe(false);
  });

  it("bakes the workbench within a performance budget", () => {
    const baked = bakeAsset({ type: "workbench" }, 2);
    expect(baked.image.stats.visibleVoxels).toBeGreaterThan(10_000);
    expect(baked.image.stats.milliseconds).toBeLessThan(1500);
  });
});

describe("resistor color code", () => {
  it.each([
    [470, ["yellow", "violet", "brown", "gold"]],
    [1000, ["brown", "black", "red", "gold"]],
    [4700, ["yellow", "violet", "red", "gold"]],
    [10, ["brown", "black", "black", "gold"]],
    [2.2, ["red", "red", "gold", "gold"]],
    [330000, ["orange", "orange", "yellow", "gold"]],
    [523, ["green", "red", "orange", "black", "gold"]],
  ])("%d Ω", (ohms, bands) => {
    expect(resistorColorCode(ohms).bands).toEqual(bands);
  });
  it("flags values that need rounding", () => {
    const c = resistorColorCode(523.6);
    expect(c.rounded).toBe(true);
    expect(c.encodedValue).toBe(524);
  });
  it("hash is stable", () => {
    expect(hashString("bench")).toBe(hashString("bench"));
  });
});
