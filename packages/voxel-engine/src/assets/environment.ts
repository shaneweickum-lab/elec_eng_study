import { VoxelGrid, textRows } from "../grid";
import { M } from "../materials";
import { createAsset, registerGenerator, type AttachmentPoint } from "../asset";

/* ------------------------------------------------------------------ floor */

export interface FloorTileParams {
  size: number;
  variant: "concrete" | "hazard";
}

export const floorTile = registerGenerator<FloorTileParams>({
  type: "floor-tile",
  version: 1,
  defaults: { size: 32, variant: "concrete" },
  states: ["concrete", "hazard"],
  generate({ size, variant }) {
    const grid = new VoxelGrid(size, size, 2);
    grid.box(0, 0, 0, size, size, 2, M.concrete);
    if (variant === "hazard") {
      grid.paint((x, y, z) => z === 1, M.safetyYellow);
      grid.paint((x, y, z) => z === 1 && Math.floor((x + y) / 4) % 2 === 0, M.safetyBlack);
    }
    // Saw-cut joints along the tile edges.
    grid.paint((x, y, z) => z === 1 && (x === 0 || y === 0), M.concreteJoint);
    return { grid };
  },
});

/* ------------------------------------------------------------------- wall */

export interface WallParams {
  length: number;
  height: number;
  /** "+y": wall runs along x and faces the viewer's left; "+x": runs along y. */
  facing: "+y" | "+x";
}

export const wallSegment = registerGenerator<WallParams>({
  type: "wall-segment",
  version: 1,
  defaults: { length: 32, height: 110, facing: "+y" },
  states: [],
  generate({ length, height, facing }) {
    const t = 3;
    const alongX = facing === "+y";
    const grid = alongX ? new VoxelGrid(length, t, height) : new VoxelGrid(t, length, height);
    grid.box(0, 0, 0, grid.width, grid.depth, height, M.wallBlock);
    // Running-bond block pattern on the visible face.
    grid.paint((x, y, z) => {
      const u = alongX ? x : y;
      const onFace = alongX ? y === t - 1 : x === t - 1;
      if (!onFace) return false;
      const course = Math.floor(z / 10);
      return z % 10 === 0 || (u + (course % 2) * 10) % 20 === 0;
    }, M.wallMortar);
    // Painted safety band near the floor.
    grid.paint((x, y, z) => z >= 2 && z < 6 && (alongX ? y === t - 1 : x === t - 1), M.safetyYellow);
    return { grid };
  },
});

/* -------------------------------------------------------------- workbench */

export interface WorkbenchParams {
  length: number;
  depth: number;
  height: number;
  riserHeight: number;
}

export const workbench = registerGenerator<WorkbenchParams>({
  type: "workbench",
  version: 1,
  defaults: { length: 200, depth: 70, height: 78, riserHeight: 58 },
  states: [],
  generate({ length: L, depth: D, height: H, riserHeight: RH }) {
    const grid = new VoxelGrid(L, D, H + RH + 16);
    // Legs and feet.
    for (const [x, y] of [
      [2, 6],
      [L - 6, 6],
      [2, D - 6],
      [L - 6, D - 6],
    ] as const) {
      grid.box(x, y, 1, x + 4, y + 4, H - 4, M.steelDark);
      grid.box(x - 1, y - 1, 0, x + 5, y + 5, 1, M.plasticBlack);
    }
    // Apron rails.
    grid.box(2, D - 6, H - 12, L - 2, D - 2, H - 4, M.steelNavy);
    grid.box(2, 6, H - 12, L - 2, 10, H - 4, M.steelNavy);
    grid.box(2, 6, H - 12, 6, D - 2, H - 4, M.steelNavy);
    grid.box(L - 6, 6, H - 12, L - 2, D - 2, H - 4, M.steelNavy);
    // Lower shelf.
    grid.box(4, 8, 12, L - 4, D - 4, 14, M.steel);
    grid.box(4, D - 5, 14, L - 4, D - 4, 16, M.steelDark);
    // Drawer pedestal.
    const px0 = L - 62;
    const px1 = L - 8;
    grid.box(px0, 10, 14, px1, D - 6, H - 12, M.steelNavy);
    const drawerHeight = Math.floor((H - 12 - 15) / 3);
    for (let k = 0; k < 3; k++) {
      const z0 = 15 + k * drawerHeight;
      grid.box(px0 + 2, D - 6, z0 + 1, px1 - 2, D - 5, z0 + drawerHeight - 1, M.steelPanel);
      const cx = (px0 + px1) / 2;
      grid.box(cx - 8, D - 5, z0 + drawerHeight - 5, cx + 8, D - 4, z0 + drawerHeight - 3, M.aluminum);
    }
    // Hardwood top with banded front edge, ESD mat and ground snap.
    grid.box(0, 4, H - 4, L, D, H, M.wood);
    grid.paint((x, y, z) => z >= H - 4 && z < H && y % 9 === 0, M.woodDark);
    grid.box(0, D - 1, H - 4, L, D, H, M.woodDark);
    grid.box(6, 10, H, L - 6, D - 4, H + 1, M.rubberMat);
    grid.cylinder("z", L - 10, D - 7, 1.4, H + 1, H + 2, M.brass);
    // Pegboard riser and top shelf.
    grid.box(0, 0, H - 4, 5, 8, H + RH, M.steelDark);
    grid.box(L - 5, 0, H - 4, L, 8, H + RH, M.steelDark);
    grid.box(5, 2, H, L - 5, 5, H + RH - 4, M.pegboard);
    grid.paint((x, y, z) => y === 4 && z < H + RH - 6 && z > H + 2 && x % 6 === 3 && (z - H) % 6 === 3, M.pegHole);
    grid.box(0, 0, H + RH - 4, L, 20, H + RH - 2, M.steelPanel);
    grid.box(0, 19, H + RH - 4, L, 20, H + RH, M.steelPanel);
    // Wire spools on the shelf (red, black, green/yellow earth).
    const spools = [
      [24, M.jackRed],
      [40, M.jackBlack],
      [56, M.jackGreen],
    ] as const;
    for (const [x, mat] of spools) {
      grid.cylinder("y", x, H + RH + 5, 6, 5, 7, M.plasticBlack);
      grid.cylinder("y", x, H + RH + 5, 5, 7, 13, mat);
      grid.cylinder("y", x, H + RH + 5, 6, 13, 15, M.plasticBlack);
    }
    // Parts bins.
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 14;
      grid.box(x, 6, H + RH - 2, x + 12, 18, H + RH + 6, i % 2 === 0 ? M.steelNavy : M.plasticGray);
      grid.box(x + 2, 17, H + RH + 2, x + 10, 18, H + RH + 4, M.plasticCream);
    }
    // Hanging hand tools on the pegboard.
    grid.line(40, 6, H + 34, 40, 6, H + 18, 0.6, M.aluminum);
    grid.box(39, 5, H + 34, 42, 7, H + 42, M.jackRed);
    grid.line(52, 6, H + 38, 48, 6, H + 22, 0.6, M.steelDark);
    grid.line(52, 6, H + 38, 56, 6, H + 22, 0.6, M.steelDark);
    grid.box(47, 5, H + 18, 50, 7, H + 24, M.jackRed);
    grid.box(54, 5, H + 18, 57, 7, H + 24, M.jackRed);
    // Power strip along the riser.
    grid.box(70, 5, H + 4, 130, 9, H + 9, M.plasticCream);
    for (let x = 76; x < 128; x += 10) grid.box(x, 8, H + 5, x + 4, 9, H + 8, M.plasticGray);
    grid.box(132, 7, H + 6, 134, 9, H + 8, M.ledRedOn);

    const attachments: AttachmentPoint[] = [{ id: "surface", kind: "surface", position: { x: 0, y: 0, z: H + 1 } }];
    return { grid, attachments };
  },
});

/* ---------------------------------------------------------------- toolbox */

export const toolbox = registerGenerator<{ color: "red" | "navy" }>({
  type: "toolbox",
  version: 1,
  defaults: { color: "red" },
  states: [],
  generate({ color }) {
    const body = color === "red" ? M.toolRed : M.steelNavy;
    const grid = new VoxelGrid(28, 14, 18);
    grid.box(0, 0, 0, 28, 14, 12, body);
    grid.box(0, 0, 12, 28, 14, 14, M.steelDark);
    grid.box(0, 0, 14, 28, 14, 15, body);
    grid.box(4, 13, 8, 7, 14, 11, M.chrome);
    grid.box(21, 13, 8, 24, 14, 11, M.chrome);
    grid.box(9, 6, 15, 10, 8, 18, M.steelDark);
    grid.box(18, 6, 15, 19, 8, 18, M.steelDark);
    grid.box(9, 6, 17, 19, 8, 18, M.chrome);
    return { grid };
  },
});

/* ------------------------------------------------------ electrical cabinet */

export interface CabinetComponent {
  kind: "contactor" | "relay" | "terminal-block" | "breaker" | "transformer";
  /** Position on the backplate (voxels from the bottom-left of the plate). */
  x: number;
  z: number;
}

export interface ElectricalCabinetParams {
  width: number;
  depth: number;
  height: number;
  material: "painted-steel" | "stainless";
  doorState: "closed" | "open";
  components: CabinetComponent[];
}

export const electricalCabinet = registerGenerator<ElectricalCabinetParams>({
  type: "electrical-cabinet",
  version: 1,
  defaults: { width: 32, depth: 18, height: 52, material: "painted-steel", doorState: "closed", components: [] },
  states: ["closed", "open"],
  generate({ width: W, depth: D, height: H, material, doorState, components }) {
    const skin = material === "stainless" ? M.aluminum : M.cabinetGray;
    const open = doorState === "open";
    const grid = new VoxelGrid(W, open ? D + W : D, H + 2);
    grid.box(0, 0, 0, W, D, 3, M.steelDark); // plinth
    grid.shell(0, 0, 3, W, D, H, 1, skin);
    // Roof lip.
    grid.box(0, 0, H - 1, W, D, H + 1, skin);
    // Interior backplate on DIN rails.
    grid.box(2, 1, 5, W - 2, 2, H - 3, M.backplate);
    for (const z of [12, 26, 40]) if (z < H - 6) grid.box(3, 2, z, W - 3, 3, z + 2, M.dinRail);
    grid.box(3, 2, 18, W - 3, 5, 21, M.wireDuct);
    for (const c of components) {
      const x = 3 + c.x;
      const z = 6 + c.z;
      switch (c.kind) {
        case "contactor":
          grid.box(x, 2, z, x + 5, 7, z + 7, M.contactorBody);
          grid.box(x + 1, 7, z + 2, x + 4, 8, z + 5, M.plasticGray);
          break;
        case "relay":
          grid.box(x, 2, z, x + 3, 6, z + 6, M.plasticCream);
          grid.box(x + 1, 6, z + 4, x + 2, 7, z + 5, M.ledAmberOn);
          break;
        case "breaker":
          grid.box(x, 2, z, x + 3, 7, z + 7, M.ceramic);
          grid.box(x + 1, 7, z + 3, x + 2, 8, z + 5, M.plasticBlack);
          break;
        case "terminal-block":
          for (let i = 0; i < 8; i++) grid.box(x + i, 2, z, x + i + 1, 5, z + 4, i % 4 === 3 ? M.jackGreen : M.plasticGray);
          break;
        case "transformer":
          grid.box(x, 2, z, x + 8, 9, z + 8, M.steelDark);
          grid.box(x + 1, 3, z + 1, x + 7, 9, z + 7, M.copper);
          break;
      }
    }
    if (!open) {
      // Closed door: proud panel, handle, louvres, arc-flash style warning label.
      grid.box(1, D - 1, 4, W - 1, D, H - 1, skin);
      grid.box(W - 5, D - 1, H / 2 - 4, W - 3, D, H / 2 + 4, M.chrome);
      for (let z = 6; z < 12; z += 2) grid.box(6, D - 1, z, W - 8, D, z + 1, M.steelDark);
      grid.box(8, D - 1, H - 20, W - 10, D, H - 9, M.safetyYellow);
      grid.stamp(textRows("!"), "front", Math.floor(W / 2) - 2, D - 1, H - 18, M.safetyBlack);
      grid.box(8, D - 1, H - 11, W - 10, D, H - 10, M.safetyBlack);
    } else {
      grid.box(1, D - 1, 4, W - 1, D, H - 1, 0);
      // Door swung 90° about its left hinge.
      grid.box(0, D, 4, 1, D + W - 2, H - 1, skin);
      grid.box(1, D + W - 6, H / 2 - 4, 2, D + W - 4, H / 2 + 4, M.chrome);
      grid.box(1, D + 4, 10, 2, D + 14, 22, M.plasticCream); // drawing pocket
    }
    return {
      grid,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: W, y: D, z: H + 1 } },
    };
  },
});

/** Convenience API matching the platform's procedural asset documentation. */
export function createElectricalCabinet(params: Partial<ElectricalCabinetParams>) {
  return createAsset({ type: "electrical-cabinet", params });
}
