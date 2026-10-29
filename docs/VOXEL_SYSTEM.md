# Procedural micro-voxel system — `@iea/voxel-engine`

All core environment art is generated from code. There are no downloaded or hand-made art assets.

## Pipeline

```
AssetDefinition { type, params }
   │ registry → generator(params)
   ▼
GeneratedAsset { VoxelGrid (Uint8 material ids), attachments, hotspots, bounds }   cached by key
   │ rasterize(grid, { unit })
   ▼
RasterImage (RGBA, origin, stats)                                                   cached by key + unit
   │ renderer uploads once
   ▼
PixiJS texture → one sprite per entity
```

The key is `type@generatorVersion#hash(stable-sorted params)`. Identical definitions share geometry and textures (all floor tiles use one texture); bumping a generator's version invalidates its bakes.

## Coordinates and projection

Voxel axes: x → screen right-down, y → screen left-down, z → up. One voxel ≈ 1 cm in Environment A.

```
screenX = (x − y) · unit
screenY = (x + y) · unit / 2 − z · unit
```

`unit` is half the on-screen width of a voxel's top face (tileWidth = 2·unit, tileHeight = unit, heightScale = unit). The world uses unit 2; textures may be baked at 2, 4 or 8 and scaled down by `2 / unit`.

## Rasterizer

The asset is never drawn as one display object per voxel. `rasterize()` bakes the visible surfaces of the whole grid into one bitmap:

- **Hidden-face elimination** — only the three camera-facing faces (top, +x, +y) exist in this fixed projection, and a face is drawn only when the neighboring cell is empty. Fully enclosed voxels are skipped before sorting.
- **Exact stamps** — with an even unit every voxel's projected origin is an integer pixel, so each face kind is a precomputed pixel stamp (inclusive edges → no gaps).
- **Painter's order** — visible voxels are bucket-sorted by `x + y + z`; for unit cubes in this projection a larger sum is never occluded by a smaller one.
- **Shading** — per-face directional factors, deterministic per-voxel noise per material, emissive materials for LEDs and displays, a silhouette outline pass.
- **Edge detail (LOD)** — at unit ≥ 4, convex edges are highlighted and concave edges darkened (cheap ambient occlusion). At unit 2 this is skipped.
- **Hit masks** — the alpha channel doubles as a pixel-exact selection mask.

## Generators

| Type | Notes |
| --- | --- |
| `floor-tile` | concrete or hazard-striped, saw-cut joints |
| `wall-segment` | running-bond block wall with safety band |
| `workbench` | legs, aprons, shelf, drawer pedestal, hardwood top, ESD mat, pegboard riser, tools, spools, parts bins, power strip |
| `bench-power-supply` | displays, CV/CC LEDs, knobs, output button, jacks; attachments for displays and jacks; hotspots for button and knobs |
| `terminal-board` | phenolic board with binding posts; one terminal attachment per post |
| `resistor` | dog-bone body with standard EIA color bands computed from resistance (4-band or 5-band) |
| `knife-switch` | ceramic base, hinge, jaw, copper blade (open / closed) |
| `jumper-link` | removable copper link with insulating sleeve |
| `multimeter` | holster, LCD, rotary selector with mode marks and pointer, three jacks |
| `test-probe` | red / black probes with tip attachment |
| `electrical-cabinet` | `createElectricalCabinet({ width, depth, height, material, doorState, components })` with contactors, relays, breakers, terminal blocks, transformers |
| `toolbox` | scenery |

Generators build on reusable primitives: `box`, `shell`, `cylinder`, `line`, `stamp` (3×5 font), `blit`, `paint`.

## Measured cost

Node 22, single core of an Intel Xeon (container). Generation = building the grid; raster = baking at the given unit.

| Asset | Unit | Grid | Solid | Visible | Faces | Gen ms | Raster ms | Texture |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workbench | 2 | 200×70×152 | 315194 | 55005 | 57399 | 20.1 | 50.0 | 540×574 |
| workbench | 4 | 200×70×152 | 315194 | 55005 | 57399 | 13.8 | 78.3 | 1080×1148 |
| workbench | 8 | 200×70×152 | 315194 | 55005 | 57399 | 12.1 | 144.6 | 2160×2296 |
| bench-power-supply | 4 | 30×27×17 | 10936 | 1496 | 1618 | 0.2 | 0.9 | 228×182 |
| bench-power-supply | 8 | 30×27×17 | 10936 | 1496 | 1618 | 0.1 | 2.8 | 456×364 |
| multimeter | 8 | 16×9×24 | 2362 | 582 | 659 | 0.1 | 1.5 | 200×292 |
| terminal-board | 4 | 96×48×7 | 9864 | 5003 | 5472 | 0.1 | 2.8 | 576×316 |
| electrical-cabinet | 4 | 32×18×54 | 9590 | 5822 | 6111 | 0.1 | 2.4 | 200×316 |
| floor-tile | 4 | 32×32×2 | 2048 | 1087 | 1152 | 0.1 | 0.6 | 256×136 |

Hidden-face elimination removes about 83 % of the workbench's solid voxels before rasterization. The renderer caps each bake to a 2048 px texture (`maxUnitFor`), so the workbench uses unit 6 when unit 8 is requested.

State changes (switch open/closed, meter dial, supply output) re-bake only the affected small asset, typically in 1–3 ms.

The renderer's performance overlay (Settings → Performance overlay) reports FPS, sprite and texture counts, current LOD, visible voxels and cumulative bake time.

## Next steps

- Bake in a Web Worker (`OffscreenCanvas` is not needed; the rasterizer already produces raw RGBA).
- Chunked rebuilds for very large assets (split grids by region, re-bake dirty chunks).
- Optional camera rotation (would require the other three face sets).
