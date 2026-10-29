import type { VoxelGrid } from "./grid";
import { MATERIALS, type Material } from "./materials";
import { hash3 } from "./random";

/**
 * Isometric software rasterizer for voxel grids.
 *
 * Instead of one display object per voxel, an asset's visible surfaces are
 * baked into a single RGBA bitmap that the renderer uploads as one texture.
 *
 *  • Hidden-face elimination: only top, +x and +y faces are visible from the
 *    fixed camera, and only where the neighboring cell is empty.
 *  • Exact pixel stamps: with an even `unit`, every voxel's projected origin
 *    lands on an integer pixel, so each face is a precomputed pixel stamp.
 *  • Painter's order: voxels are bucketed by x + y + z; for unit cubes in this
 *    projection, a larger sum is never occluded by a smaller one.
 *  • Edge detail (unit ≥ 4): convex edges are highlighted and concave edges
 *    darkened (cheap ambient occlusion). At unit 2 this is skipped — a
 *    natural level-of-detail reduction.
 */

export interface RasterOptions {
  /** Half-width in pixels of one voxel's top face. Must be an even integer ≥ 2. */
  readonly unit: number;
  /** Seed for deterministic per-voxel texture noise. */
  readonly seed?: number;
  /** Darken silhouette edges for separation against the background (default true). */
  readonly outline?: boolean;
  readonly materials?: readonly Material[];
}

export interface RasterStats {
  readonly solidVoxels: number;
  readonly visibleVoxels: number;
  readonly facesDrawn: number;
  readonly milliseconds: number;
}

export interface RasterImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, straight alpha (alpha is 0 or 255). */
  readonly pixels: Uint8ClampedArray;
  readonly unit: number;
  /** Pixel position of voxel-space origin (0,0,0) within the image. */
  readonly originX: number;
  readonly originY: number;
  readonly stats: RasterStats;
}

type FaceKind = 0 | 1 | 2; // 0 = top (+z), 1 = right (+x), 2 = left (+y)

interface Stamp {
  /** Pixel offsets relative to the voxel origin projection, interleaved [dx, dy, ...]. */
  readonly offsets: Int16Array;
  /** Per pixel bitmask of which of the 4 face edges it lies on. */
  readonly edgeBits: Uint8Array;
}

const FACE_SHADE: Record<FaceKind, number> = { 0: 1.0, 1: 0.64, 2: 0.8 };
const EMISSIVE_SHADE: Record<FaceKind, number> = { 0: 1.0, 1: 0.86, 2: 0.93 };

/** Face corners in voxel-local coordinates (dx, dy, dz), counter-clockwise on screen. */
const FACE_CORNERS: Record<FaceKind, ReadonlyArray<readonly [number, number, number]>> = {
  0: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  1: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  2: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
};
const FACE_NORMAL: Record<FaceKind, readonly [number, number, number]> = { 0: [0, 0, 1], 1: [1, 0, 0], 2: [0, 1, 0] };
/** In-plane neighbor direction for each face edge, matching FACE_CORNERS edge order. */
const EDGE_DIRECTIONS: Record<FaceKind, ReadonlyArray<readonly [number, number, number]>> = {
  0: [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]],
  1: [[0, 0, -1], [0, 1, 0], [0, 0, 1], [0, -1, 0]],
  2: [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]],
};

const stampCache = new Map<string, Stamp>();

function buildStamp(face: FaceKind, unit: number): Stamp {
  const key = `${face}:${unit}`;
  const cached = stampCache.get(key);
  if (cached) return cached;
  const corners = FACE_CORNERS[face].map(([dx, dy, dz]) => ({
    x: (dx - dy) * unit,
    y: ((dx + dy) * unit) / 2 - dz * unit,
  }));
  // Normalise winding so "inside" is always a non-negative signed distance.
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    area += a.x * b.y - b.x * a.y;
  }
  const orientation = area >= 0 ? 1 : -1;
  const offsets: number[] = [];
  const edgeBits: number[] = [];
  const band = Math.max(1, unit / 4);
  for (let py = -unit - 1; py <= unit + 1; py++) {
    for (let px = -unit - 1; px <= unit + 1; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      let inside = true;
      let bits = 0;
      for (let e = 0; e < 4; e++) {
        const a = corners[e]!;
        const b = corners[(e + 1) % 4]!;
        // Signed distance to the edge line; corners are wound so inside is ≥ 0.
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const cross = (orientation * (ex * (cy - a.y) - ey * (cx - a.x))) / Math.hypot(ex, ey);
        if (cross < -1e-9) {
          inside = false;
          break;
        }
        if (cross < band) bits |= 1 << e;
      }
      if (inside) {
        offsets.push(px, py);
        edgeBits.push(bits);
      }
    }
  }
  const stamp = { offsets: Int16Array.from(offsets), edgeBits: Uint8Array.from(edgeBits) };
  stampCache.set(key, stamp);
  return stamp;
}

export function imageSize(grid: VoxelGrid, unit: number): { width: number; height: number; originX: number; originY: number } {
  return {
    width: (grid.width + grid.depth) * unit,
    height: ((grid.width + grid.depth) * unit) / 2 + grid.height * unit,
    originX: grid.depth * unit,
    originY: grid.height * unit,
  };
}

export function rasterize(grid: VoxelGrid, options: RasterOptions): RasterImage {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { unit, seed = 1, outline = true, materials = MATERIALS } = options;
  if (!Number.isInteger(unit) || unit < 2 || unit % 2 !== 0) throw new Error(`unit must be an even integer ≥ 2 (got ${unit})`);

  if (grid.width > 1024 || grid.depth > 1024 || grid.height > 1024) throw new Error("Voxel grids are limited to 1024 cells per axis");
  const { width, height, originX, originY } = imageSize(grid, unit);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const stamps = [buildStamp(0, unit), buildStamp(1, unit), buildStamp(2, unit)] as const;
  const detailed = unit >= 4;

  const { width: W, depth: D, height: H, data } = grid;
  const solid = (x: number, y: number, z: number) =>
    x >= 0 && y >= 0 && z >= 0 && x < W && y < D && z < H && data[(z * D + y) * W + x] !== 0;

  // Collect visible voxels into buckets by x + y + z (painter's order).
  const bucketCount = W + D + H;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  let solidVoxels = 0;
  let visibleVoxels = 0;
  for (let z = 0; z < H; z++)
    for (let y = 0; y < D; y++)
      for (let x = 0; x < W; x++) {
        if (data[(z * D + y) * W + x] === 0) continue;
        solidVoxels++;
        if (solid(x, y, z + 1) && solid(x + 1, y, z) && solid(x, y + 1, z)) continue;
        visibleVoxels++;
        buckets[x + y + z]!.push(x | (y << 10) | (z << 20));
      }

  let facesDrawn = 0;
  const shadeCache = new Map<number, [number, number, number]>();
  const colorOf = (material: number): [number, number, number] => {
    let c = shadeCache.get(material);
    if (!c) {
      const hex = materials[material]?.color ?? 0xff00ff;
      c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
      shadeCache.set(material, c);
    }
    return c;
  };

  // Order faces so the top face (with its highlight) wins shared edge pixels.
  const faceOrder: readonly FaceKind[] = [2, 1, 0];
  for (const bucket of buckets) {
    for (const packed of bucket) {
      const x = packed & 1023;
      const y = (packed >> 10) & 1023;
      const z = (packed >> 20) & 1023;
      const material = data[(z * D + y) * W + x]!;
      const mat = materials[material];
      const [r0, g0, b0] = colorOf(material);
      const noise = mat ? mat.noise : 0;
      const n = noise > 0 ? 1 + ((hash3(x, y, z, seed) / 4294967295) * 2 - 1) * noise : 1;
      const ox = originX + (x - y) * unit;
      const oy = originY + ((x + y) * unit) / 2 - z * unit;

      for (const face of faceOrder) {
        const [nx, ny, nz] = FACE_NORMAL[face];
        if (solid(x + nx, y + ny, z + nz)) continue;
        facesDrawn++;
        const shade = (mat?.emissive ? EMISSIVE_SHADE[face] : FACE_SHADE[face]) * n;

        // Edge classification: convex (neighbor in plane empty) → highlight; concave → occlusion.
        const edgeFactor = [1, 1, 1, 1];
        if (detailed) {
          EDGE_DIRECTIONS[face].forEach(([ex, ey, ez], e) => {
            if (!solid(x + ex, y + ey, z + ez)) {
              if (ez >= 0) edgeFactor[e] = 1.16;
            } else if (solid(x + ex + nx, y + ey + ny, z + ez + nz)) {
              edgeFactor[e] = 0.8;
            }
          });
        }
        const stamp = stamps[face];
        const { offsets, edgeBits } = stamp;
        for (let i = 0, p = 0; i < offsets.length; i += 2, p++) {
          const px = ox + offsets[i]!;
          const py = oy + offsets[i + 1]!;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          let f = shade;
          const bits = edgeBits[p]!;
          if (detailed && bits) {
            for (let e = 0; e < 4; e++) if (bits & (1 << e)) f *= edgeFactor[e]!;
          }
          const o = (py * width + px) * 4;
          pixels[o] = r0 * f;
          pixels[o + 1] = g0 * f;
          pixels[o + 2] = b0 * f;
          pixels[o + 3] = 255;
        }
      }
    }
  }

  if (outline) applyOutline(pixels, width, height);

  const finished = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    width,
    height,
    pixels,
    unit,
    originX,
    originY,
    stats: { solidVoxels, visibleVoxels, facesDrawn, milliseconds: finished - started },
  };
}

/** Darken opaque pixels that touch transparency (silhouette outline). */
function applyOutline(pixels: Uint8ClampedArray, width: number, height: number): void {
  const edge: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (pixels[o + 3] === 0) continue;
      const transparent = (xx: number, yy: number) =>
        xx < 0 || yy < 0 || xx >= width || yy >= height || pixels[(yy * width + xx) * 4 + 3] === 0;
      if (transparent(x - 1, y) || transparent(x + 1, y) || transparent(x, y - 1) || transparent(x, y + 1)) edge.push(o);
    }
  for (const o of edge) {
    pixels[o] = pixels[o]! * 0.55;
    pixels[o + 1] = pixels[o + 1]! * 0.55;
    pixels[o + 2] = pixels[o + 2]! * 0.55;
  }
}
