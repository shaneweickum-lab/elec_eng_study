/**
 * Logical voxel grid. Axes: x → right-down on screen, y → left-down,
 * z → up. Each cell stores a material index (0 = empty).
 * All primitive ranges are half-open: [x0, x1).
 */
export class VoxelGrid {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly depth: number,
    readonly height: number,
  ) {
    if (![width, depth, height].every((n) => Number.isInteger(n) && n > 0)) {
      throw new Error(`Invalid voxel grid size ${width}×${depth}×${height}`);
    }
    this.data = new Uint8Array(width * depth * height);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.depth && z < this.height;
  }

  index(x: number, y: number, z: number): number {
    return (z * this.depth + y) * this.width + x;
  }

  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)]! : 0;
  }

  set(x: number, y: number, z: number, material: number): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    if (this.inBounds(xi, yi, zi)) this.data[this.index(xi, yi, zi)] = material;
  }

  /** Solid box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: number): this {
    const ax = Math.max(0, Math.floor(x0));
    const ay = Math.max(0, Math.floor(y0));
    const az = Math.max(0, Math.floor(z0));
    const bx = Math.min(this.width, Math.ceil(x1));
    const by = Math.min(this.depth, Math.ceil(y1));
    const bz = Math.min(this.height, Math.ceil(z1));
    for (let z = az; z < bz; z++)
      for (let y = ay; y < by; y++) {
        const row = (z * this.depth + y) * this.width;
        this.data.fill(material, row + ax, row + Math.max(ax, bx));
      }
    return this;
  }

  /** Box shell of the given wall thickness (interior left empty). */
  shell(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, thickness: number, material: number): this {
    this.box(x0, y0, z0, x1, y1, z1, material);
    return this.box(x0 + thickness, y0 + thickness, z0 + thickness, x1 - thickness, y1 - thickness, z1 - thickness, 0);
  }

  /**
   * Cylinder along an axis. (c1, c2) is the centre in the two other axes
   * (for "z": x,y; for "x": y,z; for "y": x,z); [from, to) along the axis.
   */
  cylinder(axis: "x" | "y" | "z", c1: number, c2: number, radius: number, from: number, to: number, material: number): this {
    const r2 = radius * radius;
    const lo1 = Math.floor(c1 - radius);
    const hi1 = Math.ceil(c1 + radius);
    const lo2 = Math.floor(c2 - radius);
    const hi2 = Math.ceil(c2 + radius);
    for (let a = Math.floor(from); a < Math.ceil(to); a++)
      for (let u = lo1; u < hi1; u++)
        for (let v = lo2; v < hi2; v++) {
          const du = u + 0.5 - c1;
          const dv = v + 0.5 - c2;
          if (du * du + dv * dv > r2) continue;
          if (axis === "z") this.set(u, v, a, material);
          else if (axis === "x") this.set(a, u, v, material);
          else this.set(u, a, v, material);
        }
    return this;
  }

  /** Thick 3-D line (sphere-swept), e.g. switch blades and cables. */
  line(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, radius: number, material: number): this {
    const length = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const steps = Math.max(1, Math.ceil(length * 2));
    const r = Math.ceil(radius);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const cz = z0 + (z1 - z0) * t;
      for (let dz = -r; dz <= r; dz++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const px = Math.floor(cx) + dx;
            const py = Math.floor(cy) + dy;
            const pz = Math.floor(cz) + dz;
            const ddx = px + 0.5 - cx;
            const ddy = py + 0.5 - cy;
            const ddz = pz + 0.5 - cz;
            if (ddx * ddx + ddy * ddy + ddz * ddz <= radius * radius + 0.25) this.set(px, py, pz, material);
          }
    }
    return this;
  }

  /**
   * Stamp a bitmap onto a vertical plane facing +y (front) at depth y, or a
   * plane facing +x (side) at x. Rows are top→bottom, '#' = filled.
   */
  stamp(rows: readonly string[], face: "front" | "side" | "top", u0: number, fixed: number, v0: number, material: number): this {
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== "#") continue;
        if (face === "front") this.set(u0 + c, fixed, v0 + (rows.length - 1 - r), material);
        else if (face === "side") this.set(fixed, u0 + c, v0 + (rows.length - 1 - r), material);
        else this.set(u0 + c, v0 + r, fixed, material);
      }
    });
    return this;
  }

  /** Copy another grid into this one at an offset (empty cells are transparent). */
  blit(source: VoxelGrid, ox: number, oy: number, oz: number): this {
    for (let z = 0; z < source.height; z++)
      for (let y = 0; y < source.depth; y++)
        for (let x = 0; x < source.width; x++) {
          const m = source.data[source.index(x, y, z)]!;
          if (m !== 0) this.set(x + ox, y + oy, z + oz, m);
        }
    return this;
  }

  /** Replace every voxel matching `predicate` with `material`. */
  paint(predicate: (x: number, y: number, z: number, m: number) => boolean, material: number): this {
    for (let z = 0; z < this.height; z++)
      for (let y = 0; y < this.depth; y++)
        for (let x = 0; x < this.width; x++) {
          const i = this.index(x, y, z);
          const m = this.data[i]!;
          if (m !== 0 && predicate(x, y, z, m)) this.data[i] = material;
        }
    return this;
  }

  count(): number {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== 0) n++;
    return n;
  }
}

/** 3×5 pixel font for engraved panel labels. */
const FONT: Record<string, string[]> = {
  A: ["###", "#.#", "###", "#.#", "#.#"],
  C: ["###", "#..", "#..", "#..", "###"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
  S: ["###", "#..", "###", "..#", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "5": ["###", "#..", "###", "..#", "###"],
  " ": ["...", "...", "...", "...", "..."],
};

/** Render text as stamp rows (1 voxel spacing between glyphs). */
export function textRows(text: string): string[] {
  const rows = ["", "", "", "", ""];
  [...text.toUpperCase()].forEach((ch, i) => {
    const glyph = FONT[ch] ?? FONT[" "]!;
    for (let r = 0; r < 5; r++) rows[r] += (i > 0 ? "." : "") + glyph[r];
  });
  return rows;
}
