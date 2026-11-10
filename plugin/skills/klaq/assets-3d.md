# Real Assets and Real 3D

For films that need real photos, archive images, HDRIs or 3D models instead of drawn vector, and for when SVG fake-3D (`motion-craft.md` §7) is not enough. Reference only: **`@remotion/three` and `three` are not installed** in the workspace, and there is no asset-fetching script. Anything marked "planned" below does not exist yet.

---

## 1. When to use real material

Drawn icons drifting across a blank background tend to look machine-made and give the viewer nothing to hold on to. For story and topic films, one striking real image at frame 0 (a then-and-now photo, a real object, a real number over a real image) does more than any drawn icon. For product films the real material is the product itself: real screenshots and UI (`production-pipeline.md` §0). Brand films built on one protagonist (`motion-craft.md` §1) usually need neither.

## 2. Licence rules

| Licence | Use in promotional video | Credit |
|---|---|---|
| Public domain, CC0 | Yes | Not required; keep the source anyway |
| CC BY, CC BY-SA | Yes | Required: credit line in the **post caption** |
| Any NC (non-commercial) | **No** | Draw it yourself and label it, e.g. "schematic routes" |
| Any ND (no derivatives) | **No** | Animating, cropping or grading is a derivative |
| "Editorial use only" press images | No (promotional); maybe in non-promotional content | |
| Watermarked stock | No | |
| Unknown | Not until verified | Mark the row VERIFY and do not ship it |

Log every file in `public/projects/<name>/assets/catalog.md` as you download it, one row per file, with these columns: file, what it shows, source URL, author, licence, credit text, where it is used.

Credits for every CC BY / BY-SA row go at the end of the post caption in the delivery note. The video itself carries no credits.

Label honestly: every caption or on-screen label states precisely what is pictured (for example "photo: <the exact subject>", "3D rendering" or "diagram"). Never pass off an older model as the current one, or a stock 3D object as one particular real product. If the exact image is not available under a usable licence, label it generically or build it.

## 3. Asset banks

| Bank | What | Licence (check per file) |
|---|---|---|
| Wikimedia Commons | Photos, archive images, diagrams | Mixed PD / CC0 / CC BY / CC BY-SA; read each file's page and use the original file URL |
| NASA image library, NIH/NIAID | Space, Earth, science imagery | Mostly public domain; check the credit line |
| Poly Haven | HDRIs, PBR textures, models | CC0 |
| ambientCG | PBR materials | CC0 |
| Smithsonian 3D | Scanned objects | CC0 for most |
| Natural Earth | Map data, land masks for globe textures | Public domain |
| three.js examples repo (`examples/models`, `examples/textures`) | Ready glTF models (Khronos samples such as DamagedHelmet, BoomBox), NASA Earth day/night/specular maps, HDRIs | Per model README; several Khronos samples are CC BY 4.0, some CC0 |
| Fritzchens Fritz (Flickr) | Chip die shots | CC0 |

Sketchfab requires an account: have the user download the model, or build it procedurally. Download with `curl` into a fresh folder under `public/projects/<name>/assets/` and log the row straight away. An asset fetcher that writes the catalog automatically is planned, not built.

Photos in 9:16: place the photo as a card that keeps its aspect ratio and spans the safe width, with a darkened, blurred version of the same photo filling the frame behind it; never a thin band between dark bars. Crop out museum labels and watermarks. Give real photos life with parallax layers, cut-outs, light sweeps and grain instead of leaving them still.

## 4. Real 3D in Remotion (not installed)

Install when a film needs it, matching the installed Remotion version exactly (adding packages changes the shared workspace; tell the user):

```bash
pnpm add three @react-three/fiber @remotion/three@<remotion version> && pnpm add -D @types/three
```

Rules from the local docs (`docs/remotion/three.md`, `three-canvas.md`):
- Render inside `<ThreeCanvas width={width} height={height}>`; animate from `useCurrentFrame()` in the markup. Never use R3F's `useFrame()` (it does not follow the timeline).
- `<Sequence>` inside a canvas needs `layout="none"`.
- Set the Chromium OpenGL renderer to `angle` (`Config.setChromiumOpenGlRenderer('angle')` for the CLI; `chromiumOptions: { gl: "angle" }` for `renderMedia` and `stills.ts`, which uses `renderStill` and would need the same option).
- Load GLB, HDRI and textures before the first frame (`useDelayRender()` around the loaders), from `staticFile()`.
- Deterministic: no `Math.random()` in geometry, no simulation that depends on the previous frame.

### Recipes

| Recipe | What it shows | In R3F / Remotion |
|---|---|---|
| Exploded layers | An object separating into its real layers (a cable cross-section; a chip package with lid, die textured with a real die shot, substrate, solder balls), 0 = assembled, 1 = apart, staggered per layer | One `<mesh>` per layer; position from `p = prog(f, T.explode, T.explode + 2 s)`, eased in and out with a per-layer offset. Hold at least 1 s once apart |
| Globe + arcs | The Earth with a land texture, a soft additive atmosphere, glowing route arcs that draw themselves, a camera flying between two cities | A sphere with a Natural Earth texture; arcs as `TubeGeometry` on a quadratic Bézier lifted in proportion to distance; reveal with `geometry.setDrawRange(0, n * p)`; rotate so the chosen longitude faces the camera |
| Long object on a floor | A long object on a textured floor (sand, depth fog, light shafts) seen at three-quarters, with a pulse of light running along it | A `CatmullRomCurve3` tube with a glow sprite at `curve.getPointAt(p)` |
| Photo card | A real photo as a card in 3D with parallax | A plane at the photo's aspect ratio, `toneMapped={false}` so its colours stay exact |
| Look setup | ACES tone mapping, sRGB output, an HDRI for PBR reflections, bloom | `@react-three/postprocessing` (not installed) or a manual `EffectComposer`; HDRI via drei's `<Environment files=...>` (drei not installed) or `RGBELoader` |
| Camera moves | Calm orbits and dollies with in-out cubic easing; a distance that fits an object's radius in frame | Camera position computed from the frame; the subject is fully in frame when each move ends |

Pacing for 3D: calm by default. Rotate no faster than about 20°/s, push in from 1.00 to 1.08, open exploded views over 1.5-2.5 s then hold for 1 s or longer, one major move at a time. Fast 3D tires viewers (`motion-craft.md` §12).

Licensing: three.js, R3F, drei and postprocessing are MIT. Models and HDRIs carry their own licences (section 2).
