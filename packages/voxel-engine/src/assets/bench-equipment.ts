import { VoxelGrid, textRows } from "../grid";
import { BAND_MATERIALS, M } from "../materials";
import { registerGenerator, type AttachmentPoint, type Hotspot } from "../asset";

/* ------------------------------------------------------------ bench supply */

export interface PowerSupplyParams {
  outputOn: boolean;
  /** Regulation mode indicator: lit CV or CC LED while the output is on. */
  regulation: "cv" | "cc";
}

export const benchPowerSupply = registerGenerator<PowerSupplyParams>({
  type: "bench-power-supply",
  version: 1,
  defaults: { outputOn: false, regulation: "cv" },
  states: ["output-off", "output-on-cv", "output-on-cc"],
  generate({ outputOn, regulation }) {
    const W = 30;
    const grid = new VoxelGrid(W, 27, 17);
    grid.box(0, 0, 1, W, 23, 16, M.steelNavy);
    grid.box(0, 23, 1, W, 24, 16, M.plasticGray);
    for (const [x, y] of [[1, 1], [W - 3, 1], [1, 20], [W - 3, 20]] as const) grid.box(x, y, 0, x + 2, y + 2, 1, M.plasticBlack);
    // Ventilation slots and a carry handle.
    for (let x = 4; x < W - 4; x += 3) grid.box(x, 4, 15, x + 1, 18, 16, M.steelDark);
    grid.box(3, 2, 16, 5, 6, 17, M.steelDark);
    grid.box(W - 5, 2, 16, W - 3, 6, 17, M.steelDark);
    // Displays (voltage left, current right).
    grid.box(2, 23, 9, 13, 24, 15, outputOn ? M.lcdLit : M.lcd);
    grid.box(17, 23, 9, 28, 24, 15, outputOn ? M.lcdLit : M.lcd);
    // CV / CC indicators.
    grid.box(14, 23, 13, 16, 24, 14, outputOn && regulation === "cv" ? M.ledGreenOn : M.ledGreenOff);
    grid.box(14, 23, 10, 16, 24, 11, outputOn && regulation === "cc" ? M.ledRedOn : M.ledRedOff);
    // Knobs.
    for (const x of [6, 12]) {
      grid.cylinder("y", x, 5, 2.2, 24, 26, M.plasticBlack);
      grid.box(x, 25, 6, x + 1, 26, 7, M.chrome);
    }
    // Output button and jacks.
    grid.box(16, 24, 3, 20, 25, 7, outputOn ? M.ledGreenOn : M.plasticBlack);
    grid.cylinder("y", 23.5, 5, 1.4, 24, 26, M.jackRed);
    grid.cylinder("y", 27.5, 5, 1.4, 24, 26, M.jackBlack);
    grid.stamp(textRows("+"), "front", 22, 23, 8, M.jackRed);
    grid.stamp(textRows("-"), "front", 26, 23, 8, M.chrome);

    const attachments: AttachmentPoint[] = [
      { id: "display-voltage", kind: "display", position: { x: 7.5, y: 24, z: 12 }, face: "front" },
      { id: "display-current", kind: "display", position: { x: 22.5, y: 24, z: 12 }, face: "front" },
      { id: "jack-positive", kind: "jack", position: { x: 23.5, y: 26, z: 5 }, meta: { polarity: "+" } },
      { id: "jack-negative", kind: "jack", position: { x: 27.5, y: 26, z: 5 }, meta: { polarity: "-" } },
    ];
    const hotspots: Hotspot[] = [
      { id: "output-button", label: "Output on/off", min: { x: 16, y: 24, z: 3 }, max: { x: 20, y: 25, z: 7 } },
      { id: "voltage-knob", label: "Voltage adjust", min: { x: 3.5, y: 24, z: 2.5 }, max: { x: 8.5, y: 26, z: 7.5 } },
      { id: "current-knob", label: "Current limit adjust", min: { x: 9.5, y: 24, z: 2.5 }, max: { x: 14.5, y: 26, z: 7.5 } },
    ];
    return { grid, attachments, hotspots, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: W, y: 26, z: 17 } } };
  },
});

/* ---------------------------------------------------------- terminal board */

export interface TerminalBoardParams {
  cols: number;
  rows: number;
  spacing: number;
  margin: number;
}

export const POST_TOP_Z = 6;

export const terminalBoard = registerGenerator<TerminalBoardParams>({
  type: "terminal-board",
  version: 1,
  defaults: { cols: 6, rows: 3, spacing: 16, margin: 8 },
  states: [],
  generate({ cols, rows, spacing, margin }) {
    const W = (cols - 1) * spacing + 2 * margin;
    const D = (rows - 1) * spacing + 2 * margin;
    const grid = new VoxelGrid(W, D, POST_TOP_Z + 1);
    grid.box(0, 0, 0, W, D, 2, M.phenolic);
    grid.box(0, D - 1, 0, W, D, 2, M.steelDark);
    grid.box(W - 1, 0, 0, W, D, 2, M.steelDark);
    const attachments: AttachmentPoint[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = margin + c * spacing;
        const y = margin + r * spacing;
        grid.cylinder("z", x, y, 2.4, 2, 3, M.brass);
        grid.cylinder("z", x, y, 1.3, 3, POST_TOP_Z, M.brass);
        grid.cylinder("z", x, y, 1.9, POST_TOP_Z - 1, POST_TOP_Z, M.brass);
        attachments.push({ id: `post-${c}-${r}`, kind: "terminal", position: { x, y, z: POST_TOP_Z }, meta: { col: c, row: r } });
      }
    return { grid, attachments };
  },
});

/* --------------------------------------------------------------- resistor */

export interface ResistorColorCode {
  /** Color names, first band to last (tolerance band included). */
  readonly bands: readonly string[];
  readonly significantDigits: readonly number[];
  readonly multiplierExponent: number;
  /** Value the bands actually encode (Ω). */
  readonly encodedValue: number;
  /** True when the requested value needed rounding to be expressed in bands. */
  readonly rounded: boolean;
}

export const BAND_COLOR_NAMES = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "gray", "white"] as const;

/** Standard EIA resistor color code (4-band for 2 significant digits, else 5-band). Tolerance band: gold (±5 %). */
export function resistorColorCode(ohms: number): ResistorColorCode {
  if (!(ohms > 0) || !Number.isFinite(ohms)) throw new Error(`Invalid resistance ${ohms}`);
  const encode = (digits: number) => {
    let exponent = Math.floor(Math.log10(ohms)) - (digits - 1);
    let mantissa = Math.round(ohms / 10 ** exponent);
    if (mantissa >= 10 ** digits) {
      mantissa = Math.round(mantissa / 10);
      exponent += 1;
    }
    const value = mantissa * 10 ** exponent;
    return { mantissa, exponent, value };
  };
  let digits = 2;
  let code = encode(2);
  if (Math.abs(code.value - ohms) / ohms > 1e-9) {
    digits = 3;
    code = encode(3);
  }
  const significantDigits = String(code.mantissa).padStart(digits, "0").split("").map(Number);
  const multiplier = code.exponent === -1 ? "gold" : code.exponent === -2 ? "silver" : BAND_COLOR_NAMES[code.exponent];
  if (multiplier === undefined || code.exponent < -2 || code.exponent > 9) throw new Error(`Resistance ${ohms} Ω is outside the color-code range`);
  return {
    bands: [...significantDigits.map((d) => BAND_COLOR_NAMES[d]!), multiplier, "gold"],
    significantDigits,
    multiplierExponent: code.exponent,
    encodedValue: Number(code.value.toPrecision(digits)),
    rounded: Math.abs(code.value - ohms) / ohms > 1e-9,
  };
}

const bandMaterial = (name: string): number => {
  const i = (BAND_COLOR_NAMES as readonly string[]).indexOf(name);
  if (i >= 0) return BAND_MATERIALS[i]!;
  return name === "silver" ? M.bandSilver : M.bandGold;
};

/** Transpose an x-oriented model so it runs along y. */
function alongY(source: VoxelGrid): VoxelGrid {
  const out = new VoxelGrid(source.depth, source.width, source.height);
  for (let z = 0; z < source.height; z++)
    for (let y = 0; y < source.depth; y++)
      for (let x = 0; x < source.width; x++) out.set(y, x, z, source.get(x, y, z));
  return out;
}

export interface SpanParams {
  /** Orientation of the part between its two posts. */
  axis: "x" | "y";
  /** Post-to-post distance in voxels. */
  length: number;
}

const spanAttachments = (axis: "x" | "y", length: number, z: number): AttachmentPoint[] => {
  const end = (t: number) => (axis === "x" ? { x: t, y: 2, z } : { x: 2, y: t, z });
  return [
    { id: "end-a", kind: "anchor", position: end(0) },
    { id: "end-b", kind: "anchor", position: end(length) },
  ];
};

export interface ResistorParams extends SpanParams {
  resistance: number;
}

export const resistorAsset = registerGenerator<ResistorParams>({
  type: "resistor",
  version: 1,
  defaults: { axis: "x", length: 16, resistance: 1000 },
  states: [],
  generate({ axis, length, resistance }) {
    const grid = new VoxelGrid(length + 1, 4, 5);
    // Leads: drop from post tops then run to the body.
    grid.box(0, 1.5, 0, 3, 2.5, 1, M.leadWire);
    grid.box(length - 2, 1.5, 0, length + 1, 2.5, 1, M.leadWire);
    const bodyStart = Math.round(length / 2 - 5);
    const bodyEnd = bodyStart + 10;
    grid.box(2, 1.5, 0, bodyStart, 2.5, 2, M.leadWire);
    grid.box(bodyEnd, 1.5, 0, length - 1, 2.5, 2, M.leadWire);
    // Dog-bone body.
    grid.cylinder("x", 2, 2, 1.5, bodyStart, bodyEnd, M.resistorBody);
    grid.cylinder("x", 2, 2, 2, bodyStart, bodyStart + 2, M.resistorBody);
    grid.cylinder("x", 2, 2, 2, bodyEnd - 2, bodyEnd, M.resistorBody);
    const code = resistorColorCode(resistance);
    const significant = code.bands.slice(0, -1);
    significant.forEach((band, i) => grid.cylinder("x", 2, 2, i === 0 ? 2 : 1.6, bodyStart + 1 + i, bodyStart + 2 + i, bandMaterial(band)));
    grid.cylinder("x", 2, 2, 2, bodyEnd - 2, bodyEnd - 1, bandMaterial(code.bands[code.bands.length - 1]!));
    const out = axis === "x" ? grid : alongY(grid);
    return { grid: out, attachments: spanAttachments(axis, length, 0) };
  },
});

/* ----------------------------------------------------------- knife switch */

export interface KnifeSwitchParams extends SpanParams {
  closed: boolean;
}

export const knifeSwitch = registerGenerator<KnifeSwitchParams>({
  type: "knife-switch",
  version: 1,
  defaults: { axis: "x", length: 16, closed: true },
  states: ["open", "closed"],
  generate({ axis, length, closed }) {
    const grid = new VoxelGrid(length + 1, 5, 14);
    grid.box(3, 0, 0, length - 2, 5, 1, M.ceramic);
    // Straps from posts to hinge and jaw.
    grid.box(0, 1.5, 0, 4, 3.5, 1, M.copper);
    grid.box(length - 3, 1.5, 0, length + 1, 3.5, 1, M.copper);
    // Hinge clip and jaw.
    grid.box(3, 1, 1, 5, 4, 4, M.brass);
    grid.box(length - 4, 1, 1, length - 2, 2, 4, M.brass);
    grid.box(length - 4, 3, 1, length - 2, 4, 4, M.brass);
    const pivot = { x: 4, y: 2.5, z: 3 };
    const bladeLength = length - 5;
    const angle = closed ? 0 : (60 * Math.PI) / 180;
    const tip = { x: pivot.x + bladeLength * Math.cos(angle), z: pivot.z + bladeLength * Math.sin(angle) };
    grid.line(pivot.x, pivot.y, pivot.z, tip.x, pivot.y, tip.z, 0.5, M.copper);
    // Insulated handle beyond the tip.
    const hx = tip.x + 1.5 * Math.cos(angle) - 1.5 * Math.sin(angle) * 0;
    grid.line(tip.x, pivot.y, tip.z, hx, pivot.y, tip.z + 3.5, 0.9, M.plasticBlack);
    const out = axis === "x" ? grid : alongY(grid);
    const hotspot: Hotspot =
      axis === "x"
        ? { id: "blade", label: closed ? "Open switch" : "Close switch", min: { x: 2, y: 0, z: 0 }, max: { x: length - 1, y: 5, z: 14 } }
        : { id: "blade", label: closed ? "Open switch" : "Close switch", min: { x: 0, y: 2, z: 0 }, max: { x: 5, y: length - 1, z: 14 } };
    return { grid: out, attachments: spanAttachments(axis, length, 0), hotspots: [hotspot] };
  },
});

/* ------------------------------------------------------------- jumper link */

export const jumperLink = registerGenerator<SpanParams>({
  type: "jumper-link",
  version: 1,
  defaults: { axis: "x", length: 16 },
  states: [],
  generate({ axis, length }) {
    const grid = new VoxelGrid(length + 1, 4, 3);
    grid.box(0, 1, 0, 3, 3, 1, M.copper);
    grid.box(length - 2, 1, 0, length + 1, 3, 1, M.copper);
    grid.box(2, 1, 1, length - 1, 3, 2, M.copper);
    grid.box(length / 2 - 2, 1, 2, length / 2 + 2, 3, 3, M.plasticCream); // insulating sleeve
    return { grid: axis === "x" ? grid : alongY(grid), attachments: spanAttachments(axis, length, 0) };
  },
});

/* ---------------------------------------------------------------- multimeter */

export type MeterDialPosition = "off" | "dc-voltage" | "dc-current" | "resistance" | "continuity";

/** Dial angles in degrees (front view, counter-clockwise from +x). */
export const METER_DIAL_ANGLES: Record<MeterDialPosition, number> = {
  off: 160,
  "dc-voltage": 120,
  resistance: 80,
  continuity: 45,
  "dc-current": 10,
};

export const multimeterAsset = registerGenerator<{ mode: MeterDialPosition; fuseIntact: boolean }>({
  type: "multimeter",
  version: 1,
  defaults: { mode: "off", fuseIntact: true },
  states: Object.keys(METER_DIAL_ANGLES),
  generate({ mode }) {
    const grid = new VoxelGrid(16, 9, 24);
    grid.box(0, 0, 0, 16, 6, 24, M.rubberAmber);
    grid.box(2, 5, 2, 14, 6, 22, M.plasticGray);
    grid.box(3, 5, 15, 13, 6, 21, mode === "off" ? M.lcd : M.lcdLit);
    // Rotary selector with position marks.
    const cx = 8;
    const cz = 10;
    grid.cylinder("y", cx, cz, 3.4, 6, 7, M.plasticBlack);
    grid.cylinder("y", cx, cz, 2.4, 7, 8, M.plasticBlack);
    for (const [position, angle] of Object.entries(METER_DIAL_ANGLES)) {
      const a = (angle * Math.PI) / 180;
      const selected = position === mode;
      grid.set(cx + 4.6 * Math.cos(a), 5, cz + 4.6 * Math.sin(a), selected ? M.ledAmberOn : M.chrome);
    }
    const a = (METER_DIAL_ANGLES[mode] * Math.PI) / 180;
    grid.line(cx, 8, cz, cx + 2.6 * Math.cos(a), 8, cz + 2.6 * Math.sin(a), 0.4, M.chrome);
    // Input jacks: 10 A, COM, VΩ.
    grid.cylinder("y", 4, 3.5, 1.1, 6, 7, M.jackRed);
    grid.cylinder("y", 8, 3.5, 1.1, 6, 7, M.jackBlack);
    grid.cylinder("y", 12, 3.5, 1.1, 6, 7, M.jackRed);
    // Kick-stand.
    grid.box(3, 0, 0, 13, 1, 2, M.steelDark);
    const attachments: AttachmentPoint[] = [
      { id: "display", kind: "display", position: { x: 8, y: 6, z: 18 }, face: "front" },
      { id: "jack-a", kind: "jack", position: { x: 4, y: 7, z: 3.5 } },
      { id: "jack-com", kind: "jack", position: { x: 8, y: 7, z: 3.5 } },
      { id: "jack-v", kind: "jack", position: { x: 12, y: 7, z: 3.5 } },
    ];
    const hotspots: Hotspot[] = [{ id: "dial", label: "Function selector", min: { x: 3, y: 5, z: 5 }, max: { x: 13, y: 8, z: 15 } }];
    return { grid, attachments, hotspots };
  },
});

/* ------------------------------------------------------------------ probe */

export const probeAsset = registerGenerator<{ color: "red" | "black" }>({
  type: "test-probe",
  version: 1,
  defaults: { color: "red" },
  states: [],
  generate({ color }) {
    const grid = new VoxelGrid(4, 4, 14);
    const body = color === "red" ? M.jackRed : M.jackBlack;
    grid.box(1.5, 1.5, 0, 2.5, 2.5, 3, M.chrome);
    grid.cylinder("z", 2, 2, 1.6, 3, 4, body);
    grid.cylinder("z", 2, 2, 1.1, 4, 13, body);
    grid.cylinder("z", 2, 2, 0.7, 13, 14, body);
    return { grid, attachments: [{ id: "tip", kind: "probe-tip", position: { x: 2, y: 2, z: 0 } }, { id: "cable", kind: "anchor", position: { x: 2, y: 2, z: 14 } }] };
  },
});
