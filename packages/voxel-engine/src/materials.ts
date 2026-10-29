/**
 * Material palette. A voxel stores a material index (Uint8), 0 = empty.
 * `noise` is the amplitude of deterministic per-voxel brightness variation,
 * `emissive` materials ignore directional shading (LEDs, displays).
 */
export interface Material {
  readonly name: string;
  readonly color: number; // 0xRRGGBB, sRGB
  readonly noise: number; // 0–1
  readonly emissive?: boolean;
}

const defs = {
  steel: { color: 0x6b7480, noise: 0.03 },
  steelDark: { color: 0x3c434d, noise: 0.03 },
  steelNavy: { color: 0x243650, noise: 0.025 },
  steelPanel: { color: 0x8c96a3, noise: 0.02 },
  aluminum: { color: 0xb9c1ca, noise: 0.04 },
  chrome: { color: 0xd8dee6, noise: 0.02 },
  plasticBlack: { color: 0x22262c, noise: 0.02 },
  plasticGray: { color: 0x4a5059, noise: 0.02 },
  plasticCream: { color: 0xd9cfb6, noise: 0.03 },
  rubberAmber: { color: 0xe0a422, noise: 0.03 },
  rubberMat: { color: 0x2b3d4f, noise: 0.025 },
  wood: { color: 0xa47448, noise: 0.08 },
  woodDark: { color: 0x7d5534, noise: 0.06 },
  pegboard: { color: 0x9a8c74, noise: 0.03 },
  pegHole: { color: 0x4a4236, noise: 0 },
  phenolic: { color: 0x3a2a20, noise: 0.03 },
  copper: { color: 0xc87533, noise: 0.05 },
  brass: { color: 0xc9a443, noise: 0.05 },
  leadWire: { color: 0xc4c9cf, noise: 0.02 },
  resistorBody: { color: 0xcdb27f, noise: 0.03 },
  lcd: { color: 0x101a14, noise: 0, emissive: true },
  lcdLit: { color: 0x163326, noise: 0, emissive: true },
  ledGreenOn: { color: 0x3cff8a, noise: 0, emissive: true },
  ledGreenOff: { color: 0x1d3a28, noise: 0 },
  ledRedOn: { color: 0xff4242, noise: 0, emissive: true },
  ledRedOff: { color: 0x4a1f1f, noise: 0 },
  ledAmberOn: { color: 0xffb020, noise: 0, emissive: true },
  jackRed: { color: 0xc8302c, noise: 0.02 },
  jackBlack: { color: 0x1b1d20, noise: 0.02 },
  jackGreen: { color: 0x2f8f4a, noise: 0.02 },
  concrete: { color: 0x3d4148, noise: 0.06 },
  concreteJoint: { color: 0x2a2d32, noise: 0.03 },
  wallBlock: { color: 0x30353d, noise: 0.05 },
  wallMortar: { color: 0x25292f, noise: 0.02 },
  safetyYellow: { color: 0xe8b81e, noise: 0.04 },
  safetyBlack: { color: 0x1a1a1a, noise: 0.02 },
  toolRed: { color: 0xa8272a, noise: 0.03 },
  cabinetGray: { color: 0x9aa3ad, noise: 0.02 },
  backplate: { color: 0xd8d4c8, noise: 0.02 },
  dinRail: { color: 0xaab1b8, noise: 0.03 },
  contactorBody: { color: 0x9aa0a6, noise: 0.02 },
  wireDuct: { color: 0x8d949c, noise: 0.02 },
  cyanAccent: { color: 0x22d3ee, noise: 0, emissive: true },
  ceramic: { color: 0xe7e2d6, noise: 0.03 },
  bandBlack: { color: 0x141414, noise: 0 },
  bandBrown: { color: 0x6b3b1d, noise: 0 },
  bandRed: { color: 0xc42121, noise: 0 },
  bandOrange: { color: 0xe86b12, noise: 0 },
  bandYellow: { color: 0xf2d01a, noise: 0 },
  bandGreen: { color: 0x2c9a3a, noise: 0 },
  bandBlue: { color: 0x2552c9, noise: 0 },
  bandViolet: { color: 0x7a3fc4, noise: 0 },
  bandGray: { color: 0x8a8a8a, noise: 0 },
  bandWhite: { color: 0xf3f3f3, noise: 0 },
  bandGold: { color: 0xc8a032, noise: 0.06 },
  bandSilver: { color: 0xb8bcc2, noise: 0.06 },
} satisfies Record<string, Omit<Material, "name">>;

export type MaterialName = keyof typeof defs;

/** Material table indexed by voxel value (index 0 is "empty"). */
export const MATERIALS: readonly Material[] = [
  { name: "empty", color: 0, noise: 0 },
  ...Object.entries(defs).map(([name, d]) => ({ name, ...d })),
];

/** Material name → voxel value. */
export const M = Object.fromEntries(Object.keys(defs).map((name, i) => [name, i + 1])) as Record<MaterialName, number>;

export const BAND_MATERIALS = [
  M.bandBlack,
  M.bandBrown,
  M.bandRed,
  M.bandOrange,
  M.bandYellow,
  M.bandGreen,
  M.bandBlue,
  M.bandViolet,
  M.bandGray,
  M.bandWhite,
] as const;
