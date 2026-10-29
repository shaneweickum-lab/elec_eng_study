import { Application, BufferImageSource, Container, Graphics, Matrix, Text, Texture, Sprite } from "pixi.js";
import {
  assetKey,
  bakeAsset,
  isoProject,
  maxUnitFor,
  pointInPolygon,
  type AssetDefinition,
  type BakedAsset,
  type Vec2,
  type Vec3,
} from "@iea/voxel-engine";
import type { MultimeterMode } from "@iea/circuit-sim";
import type { BenchPart } from "@/domain/bench/types";
import { POSTS } from "@/domain/bench/board";
import type { Selection } from "@/stores/bench-store";
import { partLabel } from "@/lib/format";
import {
  BENCH,
  BOARD,
  BOARD_DEF,
  CABINET_POS,
  METER_POS,
  PROBE_REST,
  ROOM,
  SUPPLY_POS,
  TOOLBOX_POS,
  WORLD_UNIT,
  partMidpoint,
  partPlacement,
  postTop,
} from "./layout";

/**
 * Isometric renderer for the training bench.
 *
 * Rendering is a pure function of a BenchView derived from simulation state;
 * the renderer never owns electrical state. Each entity is one sprite whose
 * texture is a cached voxel bake — only entities whose asset definition
 * changed are re-baked (dirty updates), and bakes are shared between
 * identical definitions (e.g. all floor tiles).
 */

export interface BenchViewPart {
  readonly part: BenchPart;
  /** Current through the part (A, a→b), null when indeterminate. */
  readonly current: number | null;
}

export interface BenchView {
  readonly parts: readonly BenchViewPart[];
  readonly supply: {
    readonly voltage: number;
    readonly current: number | null;
    readonly outputOn: boolean;
    readonly regulation: "cv" | "cc";
    readonly showCurrent: boolean;
    readonly positivePost: string;
    readonly negativePost: string;
  };
  readonly meter: {
    readonly mode: MultimeterMode;
    readonly display: string;
    readonly displayUnit: string;
    readonly red: string | null;
    readonly black: string | null;
    readonly fuseIntact: boolean;
    /** Current through the meter in current mode (A), for lead animation. */
    readonly current: number | null;
  };
  readonly selection: Selection;
  readonly options: {
    readonly showPostLabels: boolean;
    readonly showPartLabels: boolean;
    readonly showCurrentFlow: boolean;
    readonly reducedMotion: boolean;
    readonly maxDetail: number;
    readonly showPerformance: boolean;
  };
}

export type SceneTarget = Exclude<Selection, null>;

export type SceneEvent =
  | { type: "select"; target: Selection }
  | { type: "activate"; target: SceneTarget; hotspot: string }
  | { type: "hover"; label: string | null; x: number; y: number };

interface Entity {
  id: string;
  def: AssetDefinition;
  key: string;
  pos: Vec3;
  layer: number;
  label: string;
  target: SceneTarget | null;
  sprite: Sprite;
  baked: BakedAsset | null;
  unit: number;
}

interface EntitySpec {
  id: string;
  def: AssetDefinition;
  pos: Vec3;
  layer: number;
  label: string;
  target: SceneTarget | null;
}

const LAYER = { floor: 0, wall: 1, furniture: 2, benchtop: 3, board: 4, parts: 5, probes: 6 } as const;
const COLORS = { amber: 0xf5a524, cyan: 0x22d3ee, red: 0xd2423c, black: 0x1e2228, flow: 0x5eead4, label: 0xc7d2df, lcd: 0x9ff5c4, meterLcd: 0xb6f7d0 };

const project = (p: Vec3): Vec2 => isoProject(p, WORLD_UNIT);

function textureFromBake(baked: BakedAsset): Texture {
  const { image } = baked;
  const source = new BufferImageSource({
    resource: new Uint8Array(image.pixels.buffer, image.pixels.byteOffset, image.pixels.byteLength),
    width: image.width,
    height: image.height,
    scaleMode: "nearest",
  });
  return new Texture({ source });
}

export interface RendererStats {
  fps: number;
  entities: number;
  textures: number;
  bakeMs: number;
  visibleVoxels: number;
  unit: number;
}

export class BenchRenderer {
  private readonly app: Application;
  private readonly world = new Container({ sortableChildren: true });
  private readonly entityLayer = new Container({ sortableChildren: true });
  private readonly overlay = new Graphics();
  private readonly flow = new Graphics();
  private readonly labels = new Container();
  private readonly entities = new Map<string, Entity>();
  private readonly textures = new Map<string, Texture>();
  private view: BenchView | null = null;
  private unit = 4;
  private zoom = 1.6;
  private flowPhase = 0;
  private dragging: { x: number; y: number; moved: boolean } | null = null;
  private hoverTarget: string | null = null;
  private bakeMs = 0;
  private destroyed = false;
  private readonly cleanups: Array<() => void> = [];

  private constructor(
    private readonly host: HTMLElement,
    private readonly onEvent: (event: SceneEvent) => void,
    app: Application,
  ) {
    this.app = app;
  }

  static async create(host: HTMLElement, onEvent: (event: SceneEvent) => void): Promise<BenchRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: 0x0a0d12,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
    });
    const renderer = new BenchRenderer(host, onEvent, app);
    renderer.setup();
    return renderer;
  }

  private setup() {
    const { app } = this;
    app.canvas.setAttribute("aria-hidden", "true");
    app.canvas.style.display = "block";
    this.host.appendChild(app.canvas);
    this.world.addChild(this.entityLayer);
    this.flow.zIndex = 9_000_000;
    this.overlay.zIndex = 9_000_001;
    this.labels.zIndex = 9_000_002;
    this.world.addChild(this.flow, this.overlay, this.labels);
    app.stage.addChild(this.world);
    this.buildStaticScene();
    this.resetView();

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e) => {
      this.dragging = { x: e.global.x, y: e.global.y, moved: false };
    });
    app.stage.on("pointermove", (e) => {
      if (this.dragging) {
        const dx = e.global.x - this.dragging.x;
        const dy = e.global.y - this.dragging.y;
        if (this.dragging.moved || Math.hypot(dx, dy) > 4) {
          this.dragging.moved = true;
          this.world.x += dx;
          this.world.y += dy;
          this.dragging.x = e.global.x;
          this.dragging.y = e.global.y;
          this.host.style.cursor = "grabbing";
        }
        return;
      }
      this.handleHover(e.global.x, e.global.y);
    });
    const end = (e: { global: { x: number; y: number } }) => {
      const drag = this.dragging;
      this.dragging = null;
      this.host.style.cursor = "";
      if (drag && !drag.moved) this.handleTap(e.global.x, e.global.y);
    };
    app.stage.on("pointerup", end);
    app.stage.on("pointerupoutside", () => {
      this.dragging = null;
      this.host.style.cursor = "";
    });
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = app.canvas.getBoundingClientRect();
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    app.canvas.addEventListener("wheel", onWheel, { passive: false });
    this.cleanups.push(() => app.canvas.removeEventListener("wheel", onWheel));
    const onLeave = () => this.onEvent({ type: "hover", label: null, x: 0, y: 0 });
    app.canvas.addEventListener("pointerleave", onLeave);
    this.cleanups.push(() => app.canvas.removeEventListener("pointerleave", onLeave));

    let frames = 0;
    let last = performance.now();
    app.ticker.add((ticker) => {
      frames++;
      const now = performance.now();
      if (now - last > 500) {
        this.fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      if (this.view?.options.showCurrentFlow && !this.view.options.reducedMotion) {
        this.flowPhase = (this.flowPhase + ticker.deltaMS / 1000) % 1000;
        this.drawFlow();
      }
    });
  }

  private fps = 0;

  /* ----------------------------------------------------------- entities */

  private buildStaticScene() {
    const specs: EntitySpec[] = [];
    for (let tx = 0; tx < ROOM.width / ROOM.tile; tx++)
      for (let ty = 0; ty < ROOM.depth / ROOM.tile; ty++) {
        const hazard = tx >= 8 && ty === 1;
        specs.push({ id: `floor-${tx}-${ty}`, def: { type: "floor-tile", params: { size: ROOM.tile, variant: hazard ? "hazard" : "concrete" } }, pos: { x: tx * ROOM.tile, y: ty * ROOM.tile, z: -2 }, layer: LAYER.floor, label: "", target: null });
      }
    for (let i = 0; i < ROOM.width / ROOM.tile; i++) specs.push({ id: `wall-back-${i}`, def: { type: "wall-segment", params: { length: ROOM.tile, facing: "+y" } }, pos: { x: i * ROOM.tile, y: -3, z: -2 }, layer: LAYER.wall, label: "", target: null });
    for (let i = 0; i < ROOM.depth / ROOM.tile; i++) specs.push({ id: `wall-left-${i}`, def: { type: "wall-segment", params: { length: ROOM.tile, facing: "+x" } }, pos: { x: -3, y: i * ROOM.tile, z: -2 }, layer: LAYER.wall, label: "", target: null });
    specs.push({ id: "workbench", def: { type: "workbench", params: { length: BENCH.length, depth: BENCH.depth, height: BENCH.height } }, pos: { x: BENCH.x, y: BENCH.y, z: 0 }, layer: LAYER.furniture, label: "Workbench", target: null });
    specs.push({
      id: "cabinet",
      def: { type: "electrical-cabinet", params: { doorState: "closed", components: [] } },
      pos: CABINET_POS,
      layer: LAYER.furniture,
      label: "Control cabinet — Environment B (planned)",
      target: null,
    });
    specs.push({ id: "toolbox", def: { type: "toolbox", params: { color: "red" } }, pos: TOOLBOX_POS, layer: LAYER.furniture, label: "Toolbox", target: null });
    specs.push({ id: "board", def: BOARD_DEF, pos: { x: BOARD.x, y: BOARD.y, z: BOARD.z }, layer: LAYER.board, label: "Terminal board", target: null });
    for (const spec of specs) this.upsert(spec);
  }

  private upsert(spec: EntitySpec) {
    const key = assetKey(spec.def);
    let entity = this.entities.get(spec.id);
    if (!entity) {
      const sprite = new Sprite();
      sprite.roundPixels = false;
      this.entityLayer.addChild(sprite);
      entity = { ...spec, key: "", sprite, baked: null, unit: 0 };
      this.entities.set(spec.id, entity);
    }
    entity.def = spec.def;
    entity.layer = spec.layer;
    entity.label = spec.label;
    entity.target = spec.target;
    const moved = entity.pos.x !== spec.pos.x || entity.pos.y !== spec.pos.y || entity.pos.z !== spec.pos.z;
    entity.pos = spec.pos;
    if (entity.key !== key || entity.unit !== this.unitFor(spec.def)) {
      entity.key = key;
      this.bake(entity);
    } else if (moved) {
      this.place(entity);
    }
  }

  private unitFor(def: AssetDefinition): number {
    const requested = Math.min(this.unit, this.view?.options.maxDetail ?? 8);
    return maxUnitFor(def, requested, 2048);
  }

  private bake(entity: Entity) {
    const unit = this.unitFor(entity.def);
    const textureKey = `${entity.key}@u${unit}`;
    const started = performance.now();
    const baked = bakeAsset(entity.def, unit);
    let texture = this.textures.get(textureKey);
    if (!texture) {
      texture = textureFromBake(baked);
      this.textures.set(textureKey, texture);
      this.bakeMs += performance.now() - started;
    }
    entity.baked = baked;
    entity.unit = unit;
    entity.sprite.texture = texture;
    this.place(entity);
  }

  private place(entity: Entity) {
    if (!entity.baked) return;
    const scale = WORLD_UNIT / entity.unit;
    const origin = project(entity.pos);
    entity.sprite.scale.set(scale);
    entity.sprite.position.set(origin.x - entity.baked.image.originX * scale, origin.y - entity.baked.image.originY * scale);
    const { max } = entity.baked.asset.bounds;
    // Painter's order by the footprint corner nearest the viewer.
    entity.sprite.zIndex = entity.layer * 100_000 + (entity.pos.x + max.x + entity.pos.y + max.y) * 10 + entity.pos.z * 0.01;
  }

  private removeMissing(ids: Set<string>, prefix: string) {
    for (const [id, entity] of this.entities) {
      if (id.startsWith(prefix) && !ids.has(id)) {
        entity.sprite.destroy();
        this.entities.delete(id);
      }
    }
  }

  /* --------------------------------------------------------------- view */

  update(view: BenchView) {
    if (this.destroyed) return;
    const detailChanged = this.view?.options.maxDetail !== view.options.maxDetail;
    this.view = view;
    if (detailChanged) for (const e of this.entities.values()) this.bake(e);

    const specs: EntitySpec[] = [
      {
        id: "supply",
        def: { type: "bench-power-supply", params: { outputOn: view.supply.outputOn, regulation: view.supply.regulation } },
        pos: SUPPLY_POS,
        layer: LAYER.benchtop,
        label: "Bench power supply PS1",
        target: { kind: "supply" },
      },
      {
        id: "meter",
        def: { type: "multimeter", params: { mode: view.meter.mode, fuseIntact: view.meter.fuseIntact } },
        pos: METER_POS,
        layer: LAYER.benchtop,
        label: "Digital multimeter",
        target: { kind: "meter" },
      },
    ];
    const partIds = new Set<string>();
    for (const { part } of view.parts) {
      if (part.kind === "jumper" && !part.installed) continue;
      const placement = partPlacement(part);
      const id = `part-${part.id}`;
      partIds.add(id);
      specs.push({ id, def: placement.def, pos: placement.pos, layer: LAYER.parts, label: partLabel(part), target: { kind: "part", id: part.id } });
    }
    for (const probe of ["red", "black"] as const) {
      const at = view.meter[probe];
      const tip = at ? postTop(at) : PROBE_REST[probe];
      specs.push({
        id: `probe-${probe}`,
        def: { type: "test-probe", params: { color: probe } },
        pos: { x: tip.x - 2, y: tip.y - 2, z: tip.z },
        layer: LAYER.probes,
        label: probe === "red" ? "Red probe (V/Ω/A)" : "Black probe (COM)",
        target: at ? { kind: "post", id: at } : { kind: "meter" },
      });
    }
    this.removeMissing(partIds, "part-");
    for (const spec of specs) this.upsert(spec);
    this.drawOverlay();
    this.drawLabels();
    this.drawFlow();
  }

  /* ------------------------------------------------------------ overlay */

  private attachmentWorld(entityId: string, attachment: string): Vec2 | null {
    const e = this.entities.get(entityId);
    const px = e?.baked?.attachmentPixels[attachment];
    if (!e || !px) return null;
    const scale = WORLD_UNIT / e.unit;
    return { x: e.sprite.position.x + px.x * scale, y: e.sprite.position.y + px.y * scale };
  }

  private drawLead(g: Graphics, from: Vec2, to: Vec2, color: number, sag = 26) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const drop = sag + dist * 0.12;
    g.moveTo(from.x, from.y)
      .bezierCurveTo(from.x, from.y + drop, to.x, to.y + drop * 0.7, to.x, to.y)
      .stroke({ width: 2.2, color: 0x05070a, alpha: 0.9, cap: "round" });
    g.moveTo(from.x, from.y)
      .bezierCurveTo(from.x, from.y + drop, to.x, to.y + drop * 0.7, to.x, to.y)
      .stroke({ width: 1.4, color, cap: "round" });
  }

  private leadPaths(): Array<{ from: Vec2; to: Vec2; color: number; current: number | null; sag: number }> {
    const view = this.view;
    if (!view) return [];
    const paths: Array<{ from: Vec2; to: Vec2; color: number; current: number | null; sag: number }> = [];
    const plus = this.attachmentWorld("supply", "jack-positive");
    const minus = this.attachmentWorld("supply", "jack-negative");
    const supplyCurrent = view.supply.outputOn ? view.supply.current : 0;
    if (plus) paths.push({ from: plus, to: project(postTop(view.supply.positivePost)), color: COLORS.red, current: supplyCurrent, sag: 18 });
    if (minus) paths.push({ from: project(postTop(view.supply.negativePost)), to: minus, color: COLORS.black, current: supplyCurrent, sag: 18 });
    const redJack = this.attachmentWorld("meter", view.meter.mode === "dc-current" ? "jack-a" : "jack-v");
    const comJack = this.attachmentWorld("meter", "jack-com");
    const redCable = this.attachmentWorld("probe-red", "cable");
    const blackCable = this.attachmentWorld("probe-black", "cable");
    const meterCurrent = view.meter.mode === "dc-current" ? view.meter.current : 0;
    if (redJack && redCable) paths.push({ from: redCable, to: redJack, color: COLORS.red, current: meterCurrent, sag: 30 });
    if (comJack && blackCable) paths.push({ from: comJack, to: blackCable, color: COLORS.black, current: meterCurrent, sag: 30 });
    return paths;
  }

  private drawOverlay() {
    const g = this.overlay;
    g.clear();
    const view = this.view;
    if (!view) return;
    for (const lead of this.leadPaths()) this.drawLead(g, lead.from, lead.to, lead.color, lead.sag);

    // Selection and hover outlines.
    const outline = (entityId: string, color: number, width: number) => {
      const e = this.entities.get(entityId);
      if (!e?.baked) return;
      const { min, max } = e.baked.asset.bounds;
      const P = (x: number, y: number, z: number) => project({ x: e.pos.x + x, y: e.pos.y + y, z: e.pos.z + z });
      const hull = [P(min.x, min.y, max.z), P(max.x, min.y, max.z), P(max.x, min.y, min.z), P(max.x, max.y, min.z), P(min.x, max.y, min.z), P(min.x, max.y, max.z)];
      g.poly(hull.flatMap((p) => [p.x, p.y]), true).stroke({ width, color, alpha: 0.95, join: "round" });
    };
    const ring = (postId: string, color: number) => {
      const p = project(postTop(postId));
      g.ellipse(p.x, p.y, 7, 3.5).stroke({ width: 1.6, color, alpha: 0.95 });
    };
    const sel = view.selection;
    if (sel?.kind === "post") ring(sel.id, COLORS.amber);
    else if (sel?.kind === "part") outline(`part-${sel.id}`, COLORS.amber, 1.4);
    else if (sel?.kind === "supply") outline("supply", COLORS.amber, 1.4);
    else if (sel?.kind === "meter") outline("meter", COLORS.amber, 1.4);
    if (this.hoverTarget && this.hoverTarget !== selectionKey(sel)) {
      if (this.hoverTarget.startsWith("post:")) ring(this.hoverTarget.slice(5), COLORS.cyan);
      else outline(this.hoverTarget, COLORS.cyan, 1);
    }
    // Probe contact markers.
    for (const probe of ["red", "black"] as const) {
      const at = view.meter[probe];
      if (!at) continue;
      const p = project(postTop(at));
      g.circle(p.x, p.y, 2).fill({ color: probe === "red" ? COLORS.red : 0xe5e7eb });
    }
  }

  private flowSegments(): Array<{ from: Vec2; to: Vec2; current: number }> {
    const view = this.view;
    if (!view) return [];
    const segments: Array<{ from: Vec2; to: Vec2; current: number }> = [];
    for (const { part, current } of view.parts) {
      if (current === null || Math.abs(current) < 1e-7) continue;
      const a = project({ ...postTop(part.a), z: postTop(part.a).z + 3 });
      const b = project({ ...postTop(part.b), z: postTop(part.b).z + 3 });
      segments.push({ from: a, to: b, current });
    }
    for (const lead of this.leadPaths()) {
      if (lead.current !== null && Math.abs(lead.current) > 1e-7) segments.push({ from: lead.from, to: lead.to, current: Math.abs(lead.current) });
    }
    return segments;
  }

  private drawFlow() {
    const g = this.flow;
    g.clear();
    const view = this.view;
    if (!view?.options.showCurrentFlow) return;
    for (const s of this.flowSegments()) {
      const dx = s.to.x - s.from.x;
      const dy = s.to.y - s.from.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      const dir = s.current >= 0 ? 1 : -1;
      const ux = (dx / length) * dir;
      const uy = (dy / length) * dir;
      const start = dir > 0 ? s.from : s.to;
      if (view.options.reducedMotion) {
        // Static chevron at the midpoint shows conventional current direction without motion.
        const mx = (s.from.x + s.to.x) / 2;
        const my = (s.from.y + s.to.y) / 2;
        g.moveTo(mx - ux * 3 - uy * 2.5, my - uy * 3 + ux * 2.5)
          .lineTo(mx + ux * 2, my + uy * 2)
          .lineTo(mx - ux * 3 + uy * 2.5, my - uy * 3 - ux * 2.5)
          .stroke({ width: 1.5, color: COLORS.flow, alpha: 0.9 });
        continue;
      }
      const speed = Math.min(40, Math.max(6, Math.log10(Math.abs(s.current) / 1e-6) * 7));
      const spacing = 7;
      const offset = (this.flowPhase * speed) % spacing;
      for (let d = offset; d < length; d += spacing) {
        g.circle(start.x + ux * d, start.y + uy * d, 1.1).fill({ color: COLORS.flow, alpha: 0.85 });
      }
    }
  }

  private makeText(text: string, size: number, color: number, family: "mono" | "sans" = "sans"): Text {
    const fontFamily =
      family === "mono"
        ? (getComputedStyle(document.body).getPropertyValue("--font-geist-mono") || "ui-monospace") + ", ui-monospace, monospace"
        : (getComputedStyle(document.body).getPropertyValue("--font-geist-sans") || "ui-sans-serif") + ", ui-sans-serif, sans-serif";
    return new Text({ text, style: { fontFamily, fontSize: size, fill: color, fontWeight: family === "mono" ? "600" : "500" }, resolution: 4 });
  }

  /** Place text on an entity's front (+y) face so it reads as printed on the panel. */
  private faceText(text: Text, at: Vec2, heightVoxels: number) {
    const k = (heightVoxels * WORLD_UNIT) / text.height;
    text.anchor.set(0.5);
    text.setFromMatrix(new Matrix(WORLD_UNIT * k * 0.5, (WORLD_UNIT / 2) * k * 0.5, 0, WORLD_UNIT * k * 0.5, at.x, at.y));
  }

  private drawLabels() {
    const view = this.view;
    if (!view) return;
    for (const child of this.labels.removeChildren()) child.destroy();

    // Instrument displays (derived from simulation state).
    const vDisplay = this.attachmentWorld("supply", "display-voltage");
    const iDisplay = this.attachmentWorld("supply", "display-current");
    if (view.supply.outputOn && vDisplay && iDisplay) {
      const v = this.makeText(view.supply.voltage.toFixed(2), 20, COLORS.lcd, "mono");
      this.faceText(v, vDisplay, 4.2);
      const iText = view.supply.showCurrent && view.supply.current !== null ? Math.abs(view.supply.current).toFixed(3) : "-.---";
      const i = this.makeText(iText, 20, view.supply.regulation === "cc" ? 0xff8080 : COLORS.lcd, "mono");
      this.faceText(i, iDisplay, 4.2);
      this.labels.addChild(v, i);
    }
    const mDisplay = this.attachmentWorld("meter", "display");
    if (view.meter.mode !== "off" && mDisplay) {
      const main = this.makeText(view.meter.display || " ", 20, COLORS.meterLcd, "mono");
      // Offsets are in voxels along the panel: −1 along x for the digits; +4 along x, −2 down for the unit.
      this.faceText(main, { x: mDisplay.x - WORLD_UNIT, y: mDisplay.y - WORLD_UNIT / 2 }, 3.4);
      const unit = this.makeText(view.meter.displayUnit, 12, COLORS.meterLcd, "mono");
      this.faceText(unit, { x: mDisplay.x + 4 * WORLD_UNIT, y: mDisplay.y + 2 * WORLD_UNIT + 2 * WORLD_UNIT }, 1.8);
      this.labels.addChild(main, unit);
    }

    if (view.options.showPostLabels) {
      for (const p of POSTS) {
        const pos = project(postTop(p.id));
        const t = this.makeText(p.label, 9, 0x8a97a8);
        t.anchor.set(0.5, 1);
        t.scale.set(0.5);
        t.position.set(pos.x - 7, pos.y - 2);
        this.labels.addChild(t);
      }
    }
    if (view.options.showPartLabels) {
      for (const { part } of view.parts) {
        const pos = project(partMidpoint(part));
        const t = this.makeText(partLabel(part), 10, part.kind === "jumper" && !part.installed ? COLORS.amber : COLORS.label);
        t.anchor.set(0.5, 1);
        t.scale.set(0.5);
        t.position.set(pos.x, pos.y - 8);
        this.labels.addChild(t);
      }
    }
  }

  /* -------------------------------------------------------------- input */

  private toWorld(x: number, y: number): Vec2 {
    return { x: (x - this.world.x) / this.world.scale.x, y: (y - this.world.y) / this.world.scale.y };
  }

  private pick(x: number, y: number): { target: SceneTarget; entityId: string | null; hotspot: string | null; label: string } | null {
    const p = this.toWorld(x, y);
    // Posts are small; give them priority within a few pixels.
    let nearest: { id: string; d: number } | null = null;
    for (const post of POSTS) {
      const s = project(postTop(post.id));
      const d = Math.hypot((s.x - p.x) * 0.8, s.y - p.y);
      if (d < 6 && (!nearest || d < nearest.d)) nearest = { id: post.id, d };
    }
    if (nearest) return { target: { kind: "post", id: nearest.id }, entityId: null, hotspot: null, label: `Terminal ${nearest.id}` };

    const candidates = [...this.entities.values()].filter((e) => e.target && e.baked).sort((a, b) => b.sprite.zIndex - a.sprite.zIndex);
    for (const e of candidates) {
      const scale = WORLD_UNIT / e.unit;
      const lx = (p.x - e.sprite.position.x) / scale;
      const ly = (p.y - e.sprite.position.y) / scale;
      if (!e.baked!.hitTest(lx, ly)) continue;
      let hotspot: string | null = null;
      for (const [id, poly] of Object.entries(e.baked!.hotspotPolygons)) {
        if (pointInPolygon({ x: lx, y: ly }, poly)) hotspot = id;
      }
      const spot = hotspot ? e.baked!.asset.hotspots.find((h) => h.id === hotspot)?.label : null;
      return { target: e.target!, entityId: e.id, hotspot, label: spot ? `${e.label} — ${spot}` : e.label };
    }
    return null;
  }

  private handleTap(x: number, y: number) {
    const hit = this.pick(x, y);
    if (!hit) {
      this.onEvent({ type: "select", target: null });
      return;
    }
    this.onEvent({ type: "select", target: hit.target });
    if (hit.hotspot) this.onEvent({ type: "activate", target: hit.target, hotspot: hit.hotspot });
  }

  private handleHover(x: number, y: number) {
    const hit = this.pick(x, y);
    const key = hit ? (hit.entityId ?? `post:${(hit.target as { id: string }).id}`) : null;
    if (key !== this.hoverTarget) {
      this.hoverTarget = key;
      this.drawOverlay();
    }
    this.host.style.cursor = hit ? "pointer" : "";
    this.onEvent({ type: "hover", label: hit?.label ?? null, x, y });
  }

  /* ------------------------------------------------------------- camera */

  private applyZoom() {
    this.world.scale.set(this.zoom);
    const wanted = this.zoom * (window.devicePixelRatio || 1) > 2.6 ? 8 : this.zoom * (window.devicePixelRatio || 1) > 1.1 ? 4 : 2;
    if (wanted !== this.unit) {
      this.unit = wanted;
      for (const e of this.entities.values()) this.bake(e);
      this.drawOverlay();
      this.drawLabels();
    }
  }

  zoomAt(factor: number, sx: number, sy: number) {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.min(8, Math.max(0.5, this.zoom * factor));
    this.applyZoom();
    this.world.x = sx - before.x * this.zoom;
    this.world.y = sy - before.y * this.zoom;
  }

  zoomBy(factor: number) {
    this.zoomAt(factor, this.app.screen.width / 2, this.app.screen.height / 2);
  }

  panBy(dx: number, dy: number) {
    this.world.x += dx;
    this.world.y += dy;
  }

  /** Frame the work area (board, supply and meter). */
  resetView() {
    const { width, height } = this.app.screen;
    const corners = [
      project({ x: SUPPLY_POS.x, y: SUPPLY_POS.y + 26, z: SUPPLY_POS.z }),
      project({ x: SUPPLY_POS.x, y: SUPPLY_POS.y, z: SUPPLY_POS.z + 17 }),
      project({ x: METER_POS.x + 16, y: METER_POS.y, z: METER_POS.z + 24 }),
      project({ x: METER_POS.x + 30, y: METER_POS.y + 12, z: METER_POS.z }),
      project({ x: BOARD.x + 96, y: BOARD.y + 48, z: BOARD.z }),
      project({ x: BOARD.x, y: BOARD.y, z: BOARD.z + 6 }),
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    this.zoom = Math.min(5, Math.max(0.6, Math.min((width * 0.88) / (maxX - minX), (height * 0.8) / (maxY - minY))));
    this.applyZoom();
    this.world.x = width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.world.y = height / 2 - ((minY + maxY) / 2) * this.zoom;
  }

  /** Frame the whole room. */
  overview() {
    const { width, height } = this.app.screen;
    const center = project({ x: ROOM.width / 2, y: ROOM.depth / 2, z: 40 });
    this.zoom = Math.max(0.5, Math.min(width / ((ROOM.width + ROOM.depth) * WORLD_UNIT * 1.05), height / ((ROOM.width + ROOM.depth) * 1.3)));
    this.applyZoom();
    this.world.x = width / 2 - center.x * this.zoom;
    this.world.y = height / 2 - center.y * this.zoom;
  }

  /** Screen position (CSS px, relative to the canvas) of a terminal post — used by accessibility helpers and tests. */
  postScreenPosition(postId: string): Vec2 {
    const p = project(postTop(postId));
    return { x: this.world.x + p.x * this.zoom, y: this.world.y + p.y * this.zoom };
  }

  stats(): RendererStats {
    let visibleVoxels = 0;
    const seen = new Set<string>();
    for (const e of this.entities.values()) {
      if (!e.baked || seen.has(e.key)) continue;
      seen.add(e.key);
      visibleVoxels += e.baked.image.stats.visibleVoxels;
    }
    return { fps: this.fps, entities: this.entities.size, textures: this.textures.size, bakeMs: Math.round(this.bakeMs), visibleVoxels, unit: this.unit };
  }

  destroy() {
    this.destroyed = true;
    for (const c of this.cleanups) c();
    for (const t of this.textures.values()) t.destroy(true);
    this.textures.clear();
    this.app.destroy(true, { children: true });
  }
}

function selectionKey(selection: Selection): string | null {
  if (!selection) return null;
  if (selection.kind === "post") return `post:${selection.id}`;
  if (selection.kind === "part") return `part-${selection.id}`;
  return selection.kind;
}
