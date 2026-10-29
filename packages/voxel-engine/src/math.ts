export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * Isometric (2:1 dimetric) projection used by the whole platform.
 *   screenX = (x − y) · unit
 *   screenY = (x + y) · unit / 2 − z · unit
 * `unit` is half the on-screen width of one voxel's top face, so a tile of N
 * voxels has tileWidth = 2·N·unit and tileHeight = N·unit.
 */
export function isoProject(p: Vec3, unit: number): Vec2 {
  return { x: (p.x - p.y) * unit, y: ((p.x + p.y) * unit) / 2 - p.z * unit };
}

/** Inverse projection onto a horizontal plane at height z. */
export function isoUnproject(screen: Vec2, unit: number, z = 0): Vec3 {
  const a = screen.x / unit; // x − y
  const b = (2 * (screen.y + z * unit)) / unit; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2, z };
}

/** Painter's-order depth key for an object whose footprint corner nearest the viewer is p. */
export const isoDepth = (p: Vec3): number => p.x + p.y + p.z * 0.001;
