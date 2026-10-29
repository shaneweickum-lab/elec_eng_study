import { VoxelGrid } from "./grid";
import { isoProject, type Vec2, type Vec3 } from "./math";
import { hashString, stableStringify } from "./random";
import { rasterize, type RasterImage } from "./raster";

/**
 * Procedural asset contract.
 *
 * A generator turns parameters into a voxel grid plus interaction metadata
 * (attachment points, hotspots, bounds). Assets are identified by a stable
 * key derived from type, generator version and parameters, so identical
 * definitions are generated once and shared, and a version bump invalidates
 * every cached bake of that type.
 */

export type AttachmentKind = "terminal" | "jack" | "display" | "label" | "surface" | "probe-tip" | "anchor";

export interface AttachmentPoint {
  readonly id: string;
  readonly kind: AttachmentKind;
  /** Voxel-space position (may be fractional). */
  readonly position: Vec3;
  /** Optional plane for text overlays: "front" (+y face), "side" (+x face), "top". */
  readonly face?: "front" | "side" | "top";
  /** Electrical or descriptive metadata (e.g. terminal polarity). */
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
}

/** Interactive sub-region of an asset (e.g. a button on an instrument). */
export interface Hotspot {
  readonly id: string;
  readonly min: Vec3;
  readonly max: Vec3;
  readonly label: string;
}

export interface GeneratedAsset {
  readonly key: string;
  readonly type: string;
  readonly version: number;
  readonly grid: VoxelGrid;
  readonly attachments: readonly AttachmentPoint[];
  readonly hotspots: readonly Hotspot[];
  /** Selection / collision bounds in voxel space. */
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Visual states this generator can produce (documentation for animation/state wiring). */
  readonly states: readonly string[];
}

export interface GeneratorOutput {
  readonly grid: VoxelGrid;
  readonly attachments?: readonly AttachmentPoint[];
  readonly hotspots?: readonly Hotspot[];
  readonly bounds?: { readonly min: Vec3; readonly max: Vec3 };
}

export interface AssetGenerator<P extends object> {
  readonly type: string;
  readonly version: number;
  readonly defaults: P;
  readonly states: readonly string[];
  generate(params: P): GeneratorOutput;
}

export interface AssetDefinition<P extends object = Record<string, unknown>> {
  readonly type: string;
  readonly params?: Partial<P>;
}

const registry = new Map<string, AssetGenerator<object>>();

export function registerGenerator<P extends object>(generator: AssetGenerator<P>): AssetGenerator<P> {
  registry.set(generator.type, generator as unknown as AssetGenerator<object>);
  return generator;
}

export function getGenerator(type: string): AssetGenerator<object> {
  const generator = registry.get(type);
  if (!generator) throw new Error(`Unknown asset type "${type}"`);
  return generator;
}

export function registeredAssetTypes(): string[] {
  return [...registry.keys()].sort();
}

export function assetKey(definition: AssetDefinition): string {
  const generator = getGenerator(definition.type);
  const params = { ...generator.defaults, ...definition.params };
  return `${definition.type}@${generator.version}#${hashString(stableStringify(params)).toString(36)}`;
}

const generatedCache = new Map<string, GeneratedAsset>();

/** Generate (or reuse) the voxel model for a definition. */
export function createAsset(definition: AssetDefinition): GeneratedAsset {
  const key = assetKey(definition);
  const cached = generatedCache.get(key);
  if (cached) return cached;
  const generator = getGenerator(definition.type);
  const params = { ...generator.defaults, ...definition.params };
  const out = generator.generate(params);
  const asset: GeneratedAsset = {
    key,
    type: generator.type,
    version: generator.version,
    grid: out.grid,
    attachments: out.attachments ?? [],
    hotspots: out.hotspots ?? [],
    bounds: out.bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: out.grid.width, y: out.grid.depth, z: out.grid.height } },
    states: generator.states,
  };
  generatedCache.set(key, asset);
  trimCache(generatedCache, 256);
  return asset;
}

export interface BakedAsset {
  readonly asset: GeneratedAsset;
  readonly image: RasterImage;
  /** Attachment positions in image pixel coordinates. */
  readonly attachmentPixels: Readonly<Record<string, Vec2>>;
  /** Hotspot outlines (convex hull of the projected box) in image pixel coordinates. */
  readonly hotspotPolygons: Readonly<Record<string, readonly Vec2[]>>;
  /** Pixel-exact hit test in image coordinates. */
  hitTest(x: number, y: number): boolean;
}

const bakedCache = new Map<string, BakedAsset>();

/** Project a voxel-space point into an asset image. */
export function projectToImage(image: RasterImage, p: Vec3): Vec2 {
  const s = isoProject(p, image.unit);
  return { x: image.originX + s.x, y: image.originY + s.y };
}

/** Projected outline of an axis-aligned box (hexagonal hull). */
export function projectBox(image: RasterImage, min: Vec3, max: Vec3): Vec2[] {
  const P = (x: number, y: number, z: number) => projectToImage(image, { x, y, z });
  return [
    P(min.x, min.y, max.z),
    P(max.x, min.y, max.z),
    P(max.x, min.y, min.z),
    P(max.x, max.y, min.z),
    P(min.x, max.y, min.z),
    P(min.x, max.y, max.z),
  ];
}

/** Rasterize an asset at a given unit (level of detail), cached by key + unit. */
export function bakeAsset(definition: AssetDefinition, unit: number): BakedAsset {
  const asset = createAsset(definition);
  const cacheKey = `${asset.key}@u${unit}`;
  const cached = bakedCache.get(cacheKey);
  if (cached) return cached;
  const image = rasterize(asset.grid, { unit, seed: hashString(asset.key) });
  const attachmentPixels: Record<string, Vec2> = {};
  for (const a of asset.attachments) attachmentPixels[a.id] = projectToImage(image, a.position);
  const hotspotPolygons: Record<string, Vec2[]> = {};
  for (const h of asset.hotspots) hotspotPolygons[h.id] = projectBox(image, h.min, h.max);
  const baked: BakedAsset = {
    asset,
    image,
    attachmentPixels,
    hotspotPolygons,
    hitTest(x, y) {
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) return false;
      return image.pixels[(py * image.width + px) * 4 + 3]! > 0;
    },
  };
  bakedCache.set(cacheKey, baked);
  trimCache(bakedCache, 192);
  return baked;
}

/** Largest LOD unit whose bake stays within a texture size budget. */
export function maxUnitFor(definition: AssetDefinition, requested: number, maxTextureSize = 2048): number {
  const { grid } = createAsset(definition);
  let unit = requested;
  while (unit > 2) {
    const width = (grid.width + grid.depth) * unit;
    const height = ((grid.width + grid.depth) * unit) / 2 + grid.height * unit;
    if (width <= maxTextureSize && height <= maxTextureSize) break;
    unit -= 2;
  }
  return unit;
}

export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function trimCache<K, V>(cache: Map<K, V>, limit: number): void {
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as K;
    cache.delete(oldest);
  }
}

/** Drop all cached geometry and bakes (used by tests and on memory pressure). */
export function clearAssetCaches(): void {
  generatedCache.clear();
  bakedCache.clear();
}
