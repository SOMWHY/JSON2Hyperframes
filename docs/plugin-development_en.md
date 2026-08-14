# j2hf Plugin Development Guide

> Written for third-party developers. After reading this guide you can build an npm-publishable j2hf plugin from scratch.
>
> Applies to: j2hf ≥ 1.0.4 · Node ≥ 18 · ESM

---

## 1. Core Philosophy

j2hf intentionally keeps the rendering kernel minimal — **it only handles the deterministic generation of JSON → HTML + GSAP timeline**. It does not build charts, Lottie, 3D, or maps. These "visual rich components" are all left to plugins.

This has two benefits:

1. **Kernel stability**: the rendering logic for the 7 core element types (text / image / shape / group / video / audio / icon) is fixed and does not bloat with new features.
2. **Plugins are capability**: every plugin you write extends the visual vocabulary j2hf can express. A user only needs to add one line `"plugins": ["your-package-name"]` to `video-config.json` to use your capability — no `import`, no manual registration required.

Plugins can intervene in the generation pipeline at three points:

| Timing | Hook | What you can do |
|--------|------|-----------------|
| Before generation | `beforeGenerate` | Rewrite config, inject defaults, fetch remote data, validate custom fields |
| During rendering | `registerElements` | Register custom element types, take over their HTML output |
| After generation | `afterGenerate` | Read/write the generated `index.html`, inject timeline tweens, append `<script>` / `<link>`, etc. |

These three paths cover the three most common extension needs: "add a new element type", "add an animation", and "add an external resource".

---

## 2. Thirty-Second Start: Minimal Viable Plugin

```js
// my-plugin.mjs
export default {
  name: 'my-plugin',

  registerElements() {
    return {
      // Register a custom element type called "badge"
      badge: {
        render(element /*, scene */) {
          const id = element.id;
          const text = element.content || '';
          const bg = element.color || 'var(--accent)';
          return `<div id="${id}" style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:#fff;font-size:14px;">${text}</div>`;
        }
      }
    };
  }
};
```

Reference it in `video-config.json`:

```json
{
  "plugins": ["./my-plugin.mjs"],
  "scenes": [{
    "id": "s1", "start": 0, "duration": 3,
    "elements": [
      { "type": "badge", "id": "tag", "content": "NEW", "style": { "position": "absolute", "top": 100, "left": 100 } }
    ]
  }]
}
```

Run `j2hf generate` and the engine will:

1. Read the `plugins` field → dynamically `import("./my-plugin.mjs")` → take the `default` export → call `globalRegistry.register(plugin)`.
2. When rendering encounters `type: "badge"` → check the plugin registry first, find a match, and use your `render()` to produce HTML.
3. During validation, discover that `type: "badge"` is not one of the 7 built-in types → but since it is already registered, the validator **automatically skips** schema validation for that element (see Section 6 for details).

That's it. No build step, no registration API call — just declare it in the config and it works.

---

## 3. Plugin Loading Pipeline

Understanding the load order is important because it determines what your hooks receive and when.

```
runGenerate(configPath)
  │
  ├─ 1. loadConfig(configPath)            // JSON.parse the config file
  ├─ 2. loadPlugins(rawConfig)            // iterate config.plugins, import + register each
  │      └─ globalRegistry.register(plugin)
  │         └─ if plugin.registerElements exists → call immediately, merge {type: renderer} into registry
  ├─ 3. validateConfig(rawConfig)        // AJV validation, but skips paths for registered plugin element types
  ├─ 4. generate(rawConfig, outputDir)
  │      ├─ globalRegistry.runBeforeGenerate(config)   // call each plugin's beforeGenerate in order (sequential)
  │      ├─ render HTML (monolithic / modular)
  │      └─ globalRegistry.runAfterGenerate(ctx)        // call each plugin's afterGenerate in order
  └─ 5. return { files, config }
```

Key points:

- **`registerElements` executes immediately at registration time**, long before `beforeGenerate` and rendering. So your element types are already in the registry when `beforeGenerate` runs.
- **`beforeGenerate` runs sequentially in array order**, with each plugin's return value becoming the next plugin's input (pipeline pattern).
- **`afterGenerate` also runs sequentially in order**, but by now the HTML is on disk, so you can read and write `index.html` directly.
- **Plugin renderers take priority over built-in types**: if you register a renderer for `type: "text"`, it will **override** the built-in text rendering. Use with caution.

### 3.1 Plugin Specifier Syntax

Each entry in the `config.plugins` array is a string. The engine resolves it in this order:

1. First treated as an **npm package name**: `import(name)` — if it succeeds, use it.
2. On failure, treated as a **local file path** (relative to cwd): `import(pathToFileURL(path.resolve(cwd, name)).href)`.

So these are all valid:

```json
"plugins": ["./my-plugin.mjs"]                        // local file
"plugins": ["j2hf-chart"]                              // npm package (requires npm install first)
"plugins": ["j2hf-chart", "./local/custom-tweak.mjs"] // mixed
```

> Tip: npm-published plugins should be prefixed with `j2hf-` so users can easily identify them.

---

## 4. Three Extension Points in Detail

### 4.1 `beforeGenerate(config) → VideoConfig | Promise<VideoConfig>`

**Timing**: after validation, before rendering. At this point the config has passed JSON schema validation (your custom elements have been bypassed), so you can safely read and modify it.

**What you can do**:

- Inject default values (e.g., fill in missing `fillColor` for all `progress` elements).
- Audit the config (count elements, compute total duration).
- Fetch asynchronous data (`async` function — e.g., fetch API data based on `element.dataSource` and write it back to `element.content`).
- Validate plugin-private fields (schema bypass means AJV won't check your fields, so you must validate them yourself in `beforeGenerate`).

**Signature**:

```typescript
beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
```

**Always return the config** (synchronous: `return config`; async: `return await ...`). The engine uses the return value to replace its internal config object — not returning will cause downstream stages to receive `undefined`.

**Example**:

```js
beforeGenerate(config) {
  // Fill in a default palette for all custom chart elements
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !el.palette) {
        el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b'];
      }
    }
  }
  return config;
}
```

### 4.2 `registerElements() → Record<string, ElementRenderer>`

**Timing**: at plugin registration time (during the `loadPlugins` phase), long before `beforeGenerate`.

**Returns**: a `{ elementTypeName: ElementRenderer }` map. Each `ElementRenderer` has this shape:

```typescript
interface ElementRenderer {
  render: (element: any, scene: any) => string;
  //                                       └─ returns an HTML string
}
```

When rendering each element, the engine **checks the plugin registry first**:

```typescript
// Core logic in generate.ts
const customRenderer = globalRegistry.getRenderer(el.type);
if (customRenderer) {
  return customRenderer.render(el, config);   // plugin hit → use directly, skip built-in switch
}
// ... otherwise fall through to built-in text/image/shape/group/video/audio/icon
```

**`render(element, scene)` parameters**:

| Parameter | Type | Meaning |
|-----------|------|---------|
| `element` | `any` | The current element object (passed through as-is from your JSON, including `type`, `id`, `style`, and all your custom fields) |
| `scene` (second param) | `any` | The parent scene object (note: the actual runtime value is `config`, see caveat below) |

> ⚠️ **Signature caveat**: the engine actually calls `customRenderer.render(el, config)` — the second argument is the **entire `VideoConfig`**, not the scene. The type annotation in `types.ts` says `scene`, but the runtime value is `config`. If you need scene-level info (e.g., `scene.start`), resolve it from the element's parent path yourself, or use `beforeGenerate` to write scene-level info onto the element.

**HTML output conventions**:

- Must include `id="${element.id}"` — timeline animations and `afterGenerate` injections locate elements by this id.
- Return a plain HTML string; the engine does no post-processing.
- The element's `style` field is not applied automatically — you must convert `element.style` to inline styles yourself (see the style conversion helper in Section 7).
- If your element needs animation, ensure internal animation targets have locatable `id`s (e.g., `<div id="bar-fill">`), so `afterGenerate` can inject tweens or users can write `animations` in the config.

**Example**:

```js
registerElements() {
  return {
    chart: {
      render(element, config) {
        const id = element.id;
        const w = element.width || 400;
        const h = element.height || 300;
        const data = element.data || [];
        const bars = data.map((d, i) =>
          `<rect x="${i * 40}" y="${h - d}" width="30" height="${d}" fill="var(--accent)"/>`
        ).join('');
        return `<svg id="${id}" width="${w}" height="${h}" style="overflow:visible">
  ${bars}
</svg>`;
      }
    }
  };
}
```

### 4.3 `afterGenerate(ctx: PluginContext) → void | Promise<void>`

**Timing**: after HTML has been written to disk.

**`PluginContext`**:

```typescript
interface PluginContext {
  config: VideoConfig;   // the final config after beforeGenerate processing
  outputDir: string;     // absolute path to the output directory (defaults to <cwd>/output)
}
```

**What you can do**:

- Read `outputDir/index.html` and inject additional tweens into the GSAP timeline.
- Append external resources (`<link>` CSS, `<script>` library files, `<svg>` defs).
- Generate auxiliary files (e.g., export chart data as `data.json` into the output directory).
- Process modular architecture sub-composition files (note: the output directory may contain `compositions/*.html`).

**Timeline injection pattern** (the most important use case for `afterGenerate`):

The engine-generated `index.html` contains a GSAP timeline that ends with this anchor line:

```javascript
window.__timelines["<compositionId>"] = tl;
```

You can insert your tweens **before** this line, and they will be executed before the timeline is registered:

```js
import fs from 'node:fs';
import path from 'node:path';

afterGenerate(ctx) {
  const cid = ctx.config.compositionId || 'main';
  const idx = path.join(ctx.outputDir, 'index.html');
  if (!fs.existsSync(idx)) return;

  const anchor = `window.__timelines["${cid}"] = tl;`;
  let html = fs.readFileSync(idx, 'utf8');
  if (!html.includes(anchor)) return;

  const tween = `tl.to("#my-element", { width: "100%", duration: 2, ease: "power2.inOut" }, 0.5);`;
  html = html.replace(anchor, tween + '\n' + anchor);
  fs.writeFileSync(idx, html);
}
```

> **Modular architecture note**: in modular mode, timelines are distributed across `compositions/*.html` sub-files. The anchor format is identical but the file differs. To support modular mode, you need to iterate over `ctx.config.subCompositions.scenes` and process each file individually.

---

## 5. Built-in Element Types (Wheels You Don't Need to Reinvent)

Before writing a plugin, understand what the kernel can already render so you don't duplicate work. Below are the 7 built-in element types and their capabilities:

| Type | Core capability | Key properties |
|------|----------------|----------------|
| `text` | Text rendering with full typography | `content`, `typography` (fontSize / color / textAlign / letterSpacing / fontFamily / fontWeight / textTransform / lineHeight / maxWidth / fontVariantNumeric), `varBindings.varText` (bind to a variable declaration) |
| `image` | Image with load fallback | `src`, `fit` (object-fit), `radius` (corner radius px), `fallbackSrc` (onerror fallback), `varBindings.varSrc` |
| `shape` | Basic shapes | `kind` (rect / circle / ellipse / line), `backgroundColor`, `border`, `radius` (only for non-circular kinds) |
| `group` | Container + flex layout | `layout: "flex"` then supports `flexDirection` / `gap` / `align` / `justify`; recursively renders `children` |
| `video` | Video element | `src`, `muted`, `playsinline`, `data-media-start`, `data-volume`, `hasAudio`, `crossOrigin` |
| `audio` | Audio track | `src`, `data-media-start`, `data-volume`; works with `audioTracks` `fades` for fade in/out |
| `icon` | Icon | `size`, `color` |

**Fields common to all elements**:

- `id` (required) — unique element identifier; used for animation and timeline injection targeting
- `style` (optional) — inline style object with camelCase keys; the kernel auto-converts to kebab-case and auto-appends `px` to length properties
- `animations` (optional) — GSAP animation array; the kernel auto-generates `tl.to` / `tl.from` / `tl.fromTo` timeline code
- `varBindings` (optional) — variable bindings; outputs `data-*` attributes for the HyperFrames variable system
- `hidden` (optional) — outputs `data-hidden="true"`
- `layoutAudit` (optional) — outputs `data-layout-*` audit attributes

**If the capability you need is within the scope above, use the built-in type directly — no plugin needed.** Plugins are for capabilities beyond this list (see Section 9).

---

## 6. Validation Bypass Mechanism (How Your Custom Types Pass Schema Validation)

j2hf uses JSON Schema (AJV, draft-07) for strict validation. The root object and each built-in element type have `additionalProperties: false`, meaning **unknown fields cause errors**.

But plugin element types (like `badge`, `chart`, `progress`) are not in the schema's `oneOf`, so in theory AJV would flag them as "does not match any known type." The engine solves this with a function called `collectPluginElementPaths`:

1. Before rendering (during the `loadPlugins` phase), your `registerElements()` has already executed, so the registry has `badge`.
2. `validateConfig` internally calls `collectPluginElementPaths(config)`: it recursively walks all scene elements, and any element whose type is found via `globalRegistry.getRenderer(el.type)` has its JSON path recorded (e.g., `/scenes/0/elements/1`).
3. After AJV runs, errors at or under those paths are **discarded**.

Effect: your custom elements and their sub-fields are not intercepted by the built-in schema, so you can freely define any field structure.

**But you must validate yourself**: schema bypass means AJV won't check your fields. If you need constraints on custom fields (e.g., `chart` must have a `data` array), check manually in `beforeGenerate`:

```js
beforeGenerate(config) {
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !Array.isArray(el.data)) {
        throw new Error(`chart element "${el.id}" is missing the required data array`);
      }
    }
  }
  return config;
}
```

> Note: the root object is still schema-constrained — `additionalProperties: false`. Your custom fields can only live **inside element objects**, not at the config root level. Root-level extension is possible via `VideoConfig`'s `[key: string]: any` index signature (the engine won't block it), but the schema will — so root-level extension is not currently supported. Put all custom information on elements or scenes.

---

## 7. Style Conversion Helper (Reuse the Kernel's Conventions)

Built-in elements use two helper functions to process `style` objects. Your plugin's `render()` should follow the same convention to produce consistent CSS:

### 7.1 kebab-case Conversion

```js
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
// fontSize → font-size
// borderRadius → border-radius
// zIndex → z-index
```

### 7.2 Auto-Append px to Length Properties

The following properties auto-append `px` when the value is a number; other numeric values are left as-is:

```js
const LENGTH_PROPS = new Set([
  'fontSize', 'maxWidth', 'width', 'height', 'top', 'left', 'right', 'bottom',
  'gap', 'padding', 'margin', 'lineHeight', 'borderRadius', 'borderWidth'
]);
```

### 7.3 Complete styleStr Helper

You can copy this code directly into your plugin:

```js
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
const LENGTH_PROPS = new Set([
  'fontSize','maxWidth','width','height','top','left','right','bottom',
  'gap','padding','margin','lineHeight','borderRadius','borderWidth'
]);
const styleStr = (obj) =>
  obj ? Object.entries(obj)
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' && LENGTH_PROPS.has(k) ? v + 'px' : v}`)
    .join('; ') : '';
```

Usage in `render()`:

```js
render(element) {
  const s = styleStr(element.style);
  return `<div id="${element.id}"${s ? ` style="${s}"` : ''}>…</div>`;
}
```

> Note: numeric values for `opacity`, `zIndex`, `fontWeight`, etc. do **not** get `px` appended — the `LENGTH_PROPS` set above excludes them. This matches built-in element behavior.

---

## 8. Complete Walkthrough: Building a Chart Plugin from Scratch

The bar-chart plugin below demonstrates all three hooks working together. It will:
1. `beforeGenerate`: fill in default palettes for chart elements and validate the `data` field.
2. `registerElements`: register the `chart` type and render an SVG bar chart.
3. `afterGenerate`: inject a "bars grow sequentially" stagger animation into the timeline.

### 8.1 Plugin Code

```js
// j2hf-chart.mjs
import fs from 'node:fs';
import path from 'node:path';

const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
const LENGTH_PROPS = new Set(['width','height','top','left','right','bottom','gap','fontSize']);
const styleStr = (obj) =>
  obj ? Object.entries(obj)
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' && LENGTH_PROPS.has(k) ? v + 'px' : v}`)
    .join('; ') : '';

export default {
  name: 'j2hf-chart',

  // ── Hook 1: before generation — validate + inject defaults ──
  beforeGenerate(config) {
    for (const scene of config.scenes || []) {
      for (const el of scene.elements || []) {
        if (el.type !== 'chart') continue;

        // Validate
        if (!Array.isArray(el.data)) {
          throw new Error(`[j2hf-chart] element "${el.id}" is missing the required data array`);
        }

        // Inject defaults
        if (!el.palette) {
          el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        }
        if (!el.barWidth) el.barWidth = 60;
        if (!el.gap) el.gap = 20;
      }
    }
    return config;
  },

  // ── Hook 2: register custom element type ──
  registerElements() {
    return {
      chart: {
        render(element /*, config */) {
          const id = element.id;
          const data = element.data;
          const palette = element.palette;
          const barWidth = element.barWidth;
          const gap = element.gap;
          const w = element.width || data.length * (barWidth + gap);
          const h = element.height || 300;
          const maxVal = Math.max(...data.map(d => d.value), 1);

          const bars = data.map((d, i) => {
            const barH = (d.value / maxVal) * h;
            const x = i * (barWidth + gap);
            const y = h - barH;
            const color = palette[i % palette.length];
            // Each bar has its own id for afterGenerate animation targeting
            return `<rect id="${id}-bar-${i}" x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="4" style="transform-origin:${x + barWidth/2}px ${y}px"/>`;
          }).join('');

          const labels = data.map((d, i) => {
            const x = i * (barWidth + gap) + barWidth / 2;
            return `<text x="${x}" y="${h + 20}" text-anchor="middle" fill="var(--foreground)" font-size="14">${d.label || ''}</text>`;
          }).join('');

          const s = styleStr(element.style);
          return `<svg id="${id}" width="${w}" height="${h + 40}"${s ? ` style="${s};overflow:visible"` : ' style="overflow:visible"'}>
  ${bars}
  ${labels}
</svg>`;
        }
      }
    };
  },

  // ── Hook 3: after generation — inject stagger animation ──
  afterGenerate(ctx) {
    const cid = ctx.config.compositionId || 'main';
    const idx = path.join(ctx.outputDir, 'index.html');
    if (!fs.existsSync(idx)) return;

    const lines = [];
    for (const scene of ctx.config.scenes || []) {
      for (const el of scene.elements || []) {
        if (el.type !== 'chart') continue;

        const at = el.animateAt ?? scene.start ?? 0;
        const stagger = el.stagger ?? 0.1;
        const dur = el.barDuration ?? 0.6;

        // Each bar grows from scaleY: 0
        for (let i = 0; i < el.data.length; i++) {
          lines.push(`tl.from("#${el.id}-bar-${i}", { scaleY: 0, duration: ${dur}, ease: "power3.out" }, ${at + i * stagger});`);
        }
      }
    }

    if (!lines.length) return;

    let html = fs.readFileSync(idx, 'utf8');
    const anchor = `window.__timelines["${cid}"] = tl;`;
    if (!html.includes(anchor)) return;

    html = html.replace(anchor, lines.join('\n') + '\n' + anchor);
    fs.writeFileSync(idx, html);
    console.log(`  [j2hf-chart] injected ${lines.length} bar pop-in animations`);
  }
};
```

### 8.2 Corresponding Config

```json
{
  "$schema": "../schemas/video-config.schema.json",
  "compositionId": "chart-demo",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "plugins": ["./j2hf-chart.mjs"],
  "palette": {
    "background": "#0f172a",
    "foreground": "#e2e8f0",
    "accent": "#3b82f6"
  },
  "scenes": [{
    "id": "s1",
    "start": 0,
    "duration": 4,
    "elements": [{
      "type": "chart",
      "id": "sales-chart",
      "data": [
        { "label": "Q1", "value": 30 },
        { "label": "Q2", "value": 65 },
        { "label": "Q3", "value": 45 },
        { "label": "Q4", "value": 80 }
      ],
      "width": 400,
      "height": 250,
      "barWidth": 60,
      "gap": 20,
      "stagger": 0.15,
      "barDuration": 0.6,
      "style": { "position": "absolute", "top": 400, "left": 200 }
    }]
  }]
}
```

### 8.3 Run

```bash
j2hf generate
```

You should see `[j2hf-chart] injected 4 bar pop-in animations`, and the generated page will show bars growing from the bottom one by one.

---

## 9. Core Capabilities vs. What Still Needs Plugins

### 9.1 What the Core Already Has (No Plugin Needed)

| Domain | Capability |
|--------|-----------|
| Layout | Absolute positioning, flex containers (group + layout), recursive rendering of nested children |
| Text | Full typography properties (font size / weight / letter spacing / line height / alignment / font variant), variable binding |
| Media | Image (with fallback), video (with cross-origin / volume control), audio (with fade in/out) |
| Shapes | Rectangle / circle / ellipse / line, borders, corner radius |
| Animation | Full GSAP timeline support (to / from / fromTo), recursive element animation collection, scene-level background animation |
| Transitions | 6 implemented: crossfade, blur-crossfade, zoom-through, zoom-out, push-slide, color-dip-black |
| Variables | CSS variable declaration and auto-injection, per-composition scoping |
| Architecture | monolithic (single file) and modular (host composition + sub-compositions) output modes |
| Validation | Strict JSON Schema validation + automatic bypass for plugin elements |

### 9.2 What Still Needs Plugins (Known Gaps)

The core **intentionally does not** implement these — they are left for the ecosystem. Contributions welcome:

#### 🔴 High-Value Gaps

| Direction | Description | Hooks involved |
|-----------|-------------|-----------------|
| **Charts** | Bar, line, pie, area charts. Best approach: `registerElements` renders SVG, `afterGenerate` injects draw animations | All three |
| **Lottie animations** | Render a `<lottie-player>` container, `afterGenerate` injects lottie-web script and playback control | `registerElements` + `afterGenerate` |
| **3D / WebGL** | Render a `<canvas>` container, `afterGenerate` injects Three.js code and a render loop entered from the timeline | `registerElements` + `afterGenerate` |
| **Maps** | Render a container, `afterGenerate` injects Leaflet / Mapbox GL initialization script | `registerElements` + `afterGenerate` |
| **QR codes** | Render an `<img>` or `<svg>`; can be done synchronously in `registerElements` using the `qrcode` npm package, no `afterGenerate` needed | `registerElements` |

#### 🟡 Medium-Value Gaps

| Direction | Description | Hooks involved |
|-----------|-------------|-----------------|
| **More transitions** | The schema defines 27 transition types but only 6 are implemented. The remaining 21 (glitch, ripple, staggered-blocks, clock-wipe, etc.) need plugins. Can be implemented as `afterGenerate` timeline injection | `afterGenerate` |
| **Resource subsetting** | Trim images / fonts / videos to only what each scene actually uses, reducing output size. Best done as `beforeGenerate` analysis + `afterGenerate` file operations | `beforeGenerate` + `afterGenerate` |
| **Code highlighting** | Render `<pre><code>` + `afterGenerate` inject highlight.js / Prism scripts | `registerElements` + `afterGenerate` |
| **Math formulas** | Render a container + `afterGenerate` inject KaTeX / MathJax | `registerElements` + `afterGenerate` |
| **Markdown rendering** | Convert `element.content` Markdown to HTML output; can be done synchronously in `registerElements` | `registerElements` |

#### 🟢 Future Gaps

| Direction | Description |
|-----------|-------------|
| **WebGL shader transitions** | The schema's `transitionConfig.shader` field is already reserved (comment: "Reserved for future WebGL shader transitions. Not implemented in v1."), awaiting plugin implementation |
| **Modular sub-composition injection** | Currently `afterGenerate` mainly targets `index.html`. For modular mode, animation injection into sub-composition files (`compositions/*.html`) requires iteration — no established pattern yet |
| **Font subsetting** | Subset woff2 fonts based on actually-used characters to reduce size |

### 9.3 If You Want to Claim a Direction

Recommended plugin naming convention:

```
j2hf-<capability>     // e.g. j2hf-chart, j2hf-lottie, j2hf-qrcode
```

Key `package.json` fields:

```json
{
  "name": "j2hf-chart",
  "type": "module",
  "main": "dist/index.mjs",
  "exports": {
    ".": {
      "import": "./dist/index.mjs"
    }
  },
  "peerDependencies": {
    "j2hf": ">=1.0.4"
  }
}
```

The plugin entry only needs to `export default` a `J2hfPlugin` object:

```js
// dist/index.mjs
export default {
  name: 'j2hf-chart',
  beforeGenerate(config) { /* ... */ return config; },
  registerElements() { return { chart: { render(el) { /* ... */ } } }; },
  afterGenerate(ctx) { /* ... */ }
};
```

Publish:

```bash
npm publish
```

User consumption:

```bash
npm install j2hf-chart
```

```json
{ "plugins": ["j2hf-chart"] }
```

---

## 10. API Reference

### 10.1 `J2hfPlugin` (Plugin Object Shape)

```typescript
interface J2hfPlugin {
  /** Plugin name, required — used for logging and debugging */
  name: string;

  /** Before-generation hook: rewrite / validate / fetch async data. Must return config */
  beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;

  /** Register custom element types. Returns { typeName: ElementRenderer } */
  registerElements?: () => Record<string, ElementRenderer>;

  /** After-generation hook: read/write generated HTML, inject resources / animations */
  afterGenerate?: (ctx: PluginContext) => void | Promise<void>;
}
```

### 10.2 `ElementRenderer` (Element Renderer)

```typescript
interface ElementRenderer {
  /**
   * @param element  the current element object (raw from JSON, includes id / style / custom fields)
   * @param config   the entire VideoConfig (note: type annotation says scene, runtime value is config)
   * @returns        an HTML string
   */
  render: (element: any, config: any) => string;
}
```

### 10.3 `PluginContext` (afterGenerate Context)

```typescript
interface PluginContext {
  config: VideoConfig;   // the final config after beforeGenerate processing
  outputDir: string;     // absolute path to the output directory
}
```

### 10.4 `VideoConfig` (Config Object, Full Fields)

```typescript
interface VideoConfig {
  width?: number;                    // canvas width, default 1920
  height?: number;                   // canvas height, default 1080
  fps?: number;                      // frame rate, default 30
  compositionId?: string;            // composition ID, required — used for timeline registration
  architecture?: 'monolithic' | 'modular';  // output architecture, default monolithic
  subCompositions?: { scenes?: any[] };     // sub-composition definitions for modular mode
  palette?: {
    background?: string;
    foreground?: string;
    accent?: string;
    neutral?: string[];
    themeRef?: string;
  };
  typography?: { bodyFont?: string; headlineFont?: string };
  variables?: { declarations?: Array<{ id: string; type: string; default: any }> };
  renderSettings?: { output?: string; quality?: string; fps?: number; strict?: boolean };
  plugins?: string[];               // plugin specifier array (npm names / local paths)
  scenes?: Scene[];                  // scenes array (required)
  audioTracks?: AudioTrack[];        // audio tracks
  [key: string]: any;                // index signature (engine allows, but schema disallows unknown root fields)
}
```

### 10.5 Importing Types from j2hf (for TypeScript Plugins)

```typescript
import type { J2hfPlugin, ElementRenderer, PluginContext, VideoConfig } from 'j2hf';
```

These types are re-exported from the `j2hf` package's `dist/lib/generate.d.ts` (`generate.ts` does `export * from './types.js'`).

### 10.6 Programmatic Invocation (Run Plugins Without the CLI)

```typescript
import { runGenerate } from 'j2hf';

await runGenerate('video-config.json', { outputDir: 'output' });
```

Or at a lower level:

```typescript
import { loadConfig, generate, globalRegistry } from 'j2hf';

// Register the plugin manually (bypass config.plugins declaration)
import myPlugin from './my-plugin.mjs';
globalRegistry.register(myPlugin);

const config = loadConfig('video-config.json');
const { files, config: finalConfig } = await generate(config, 'output');
```

---

## 11. Debugging Tips

### 11.1 Check Whether Your Plugin Was Loaded

When you run `j2hf generate`, the console prints:

```
• Loaded plugin: j2hf-progress +customElements +beforeGenerate +afterGenerate
```

If you don't see this line, the specifier failed to resolve.

### 11.2 Inspect the Generated HTML

```bash
j2hf generate
# output is in output/index.html
cat output/index.html | grep "<your-element-id>"
```

### 11.3 Verify Timeline Injection

```bash
grep "window.__timelines" output/index.html
# check whether your tween appears before this line
```

### 11.4 Common Error Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `✗ Failed to load plugin: "xxx"` | npm package not installed / wrong local path | `npm install xxx` or verify the relative path is relative to cwd |
| `✗ Plugin "xxx" did not export a valid J2hfPlugin (missing .name)` | Exported object has no `name` field | Ensure `export default { name: '...', ... }` |
| Element renders as `<!-- Unknown element type: xxx -->` | `registerElements` didn't return that type, or type name is misspelled | Verify the key returned by `registerElements()` exactly matches the `type` in the config |
| Validation error on your custom element | The element's type wasn't registered (bypass not triggered) | Confirm the plugin loads before `validateConfig` — it registers during `loadPlugins`, which is before validation |
| `afterGenerate` reports `anchor not found` | compositionId mismatch, or the file is not `index.html` (modular mode) | Check `ctx.config.compositionId`; for modular mode, iterate over `compositions/*.html` |

---

## 12. Reference Implementation

The bundled `examples/plugins/j2hf-progress.mjs` in the repository is a production-ready minimal plugin that exercises all three hooks simultaneously. We recommend reading its source first before writing your own plugin.

The corresponding config example is in `examples/plugin-demo.json`. Run it with:

```bash
j2hf generate --config examples/plugin-demo.json
j2hf preview
```

---

## Appendix: Glossary

| j2hf Term | Meaning |
|-----------|---------|
| composition | A complete work (corresponds to one `compositionId` and one GSAP timeline) |
| scene | A scene segment within a composition (a `clip`), with its own `start` / `duration` |
| element | A concrete element within a scene (text / image / shape / ...) |
| clip | The outer container for each scene in the generated HTML: `<section class="clip" id="clip-<id>">` |
| timeline | The engine-generated GSAP timeline object, stored at `window.__timelines[compositionId]` |
| modular | Multi-file output architecture where the host composition references sub-composition HTML files |
| plugin | A `J2hfPlugin` object that auto-loads when declared via `config.plugins` |
