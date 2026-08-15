# Skill: Write j2hf Plugins

> This skill guides an Agent through writing a j2hf plugin — from a minimal custom element to a full plugin using all three extension hooks.
>
> **Prerequisite reading**: [element-types.md](./element-types.md) (confirm the built-in types don't already cover your need)

---

## 1. Core Philosophy

j2hf intentionally keeps its rendering kernel minimal — it only does deterministic JSON → HTML + GSAP timeline generation. It does not do charts, Lottie, 3D, maps, or code highlighting. All "rich visual components" are left to plugins.

A plugin extends j2hf via **three hooks**:

| Timing | Hook | What you can do |
|--------|------|-----------------|
| Before generation | `beforeGenerate(config)` | Mutate config, inject defaults, fetch remote data, validate custom fields |
| During rendering | `registerElements()` | Register custom element types, take over HTML output for those types |
| After generation | `afterGenerate(ctx)` | Read/write the generated `index.html`, inject timeline tweens, append resources |

---

## 2. Plugin Loading Flow

Understanding the load order is critical — it determines what your hooks receive.

```
runGenerate(configPath)
  │
  ├─ 1. loadConfig(configPath)           → JSON.parse the config file
  ├─ 2. loadPlugins(rawConfig)           → iterate config.plugins, import + register each
  │      └─ globalRegistry.register(plugin)
  │         └─ if plugin.registerElements exists → called IMMEDIATELY
  ├─ 3. validateConfig(rawConfig)        → AJV validation, but skips plugin-registered element paths
  ├─ 4. generate(rawConfig, outputDir)
  │      ├─ globalRegistry.runBeforeGenerate(config)  → serial pipeline (each plugin's output feeds the next)
  │      ├─ render HTML (monolithic or modular)
  │      └─ globalRegistry.runAfterGenerate(ctx)      → serial, HTML is already on disk
  └─ 5. return { files, config }
```

### Key points

- **`registerElements` executes at registration time** — far earlier than `beforeGenerate` or rendering. Your element types are in the registry before `beforeGenerate` runs.
- **`beforeGenerate` runs serially** — the return value of plugin A becomes the input of plugin B (pipeline model). Always `return config`.
- **`afterGenerate` runs serially** after HTML is written to disk. You can directly read/write `index.html`.
- **Plugin renderers take priority over built-in types**: if you register a `type: "text"` renderer, it **overrides** the built-in text renderer. Use with caution.

### Plugin specifier resolution

Each entry in `config.plugins` is a string resolved in this order:
1. Try `import(name)` as an **npm package name**.
2. If that fails, resolve as a **local file path** (relative to cwd): `import(pathToFileURL(path.resolve(cwd, name)).href)`.

```jsonc
"plugins": ["./my-plugin.mjs"]                        // local file
"plugins": ["j2hf-chart"]                              // npm package (requires npm install)
"plugins": ["j2hf-chart", "./local/custom-tweak.mjs"] // mixed
```

Naming convention for published plugins: prefix with `j2hf-` (e.g. `j2hf-chart`, `j2hf-lottie`).

---

## 3. Minimal Plugin: 30-Second Start

```js
// my-plugin.mjs
export default {
  name: 'my-plugin',

  registerElements() {
    return {
      // Register a custom element type called "badge"
      badge: {
        render(element /*, config */) {
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

Use it in `video-config.json`:

```jsonc
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

Run `j2hf generate`. The engine will:
1. See `plugins` → dynamic `import("./my-plugin.mjs")` → `default` export → `globalRegistry.register(plugin)`.
2. When rendering encounters `type: "badge"` → check plugin registry first → hit → use your `render()`.
3. During validation, `type: "badge"` isn't in the built-in element union → but it's registered → AJV errors for that element path are **discarded** automatically.

No build step, no registration API call — just add to config and go.

---

## 4. Three Hooks in Detail

### 4.1 `beforeGenerate(config) → VideoConfig | Promise<VideoConfig>`

**Timing**: After validation, before rendering. Your custom elements have already passed the schema bypass.

**What you can do**:
- Inject default values for your custom elements.
- Audit the config (count elements, compute durations).
- Fetch async data (`async` function — e.g., fetch API data and write it back into `element.content`).
- Validate plugin-private fields (schema bypass means AJV won't check your fields).

**Signature**:
```typescript
beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
```

**Always return config** — the engine replaces its internal config with your return value. Not returning gives subsequent steps `undefined`.

**Example**:
```js
beforeGenerate(config) {
  // Inject default palette for all chart elements missing one
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !el.palette) {
        el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b'];
      }
    }
  }
  return config;  // ← always return!
}
```

### 4.2 `registerElements() → Record<string, ElementRenderer>`

**Timing**: At plugin registration time (during `loadPlugins`), before `beforeGenerate`.

**Returns**: A map of `{ elementTypeName: ElementRenderer }`.

**ElementRenderer shape**:
```typescript
interface ElementRenderer {
  render: (element: any, config: any) => string;
  //  element: the current element object (has type, id, style, and your custom fields)
  //  config:  the entire VideoConfig (NOTE: the type annotation says "scene" but the runtime value is config)
  //  returns: an HTML string
}
```

The engine checks the plugin registry **before** the built-in switch:

```typescript
// generate.ts core logic
const customRenderer = globalRegistry.getRenderer(el.type);
if (customRenderer) {
  return customRenderer.render(el, config);   // plugin hit → use it, skip built-in switch
}
// ... otherwise fall through to built-in text/image/shape/group/video/audio/icon
```

**HTML output conventions**:
- **MUST include `id="${element.id}"`** — timeline animations and `afterGenerate` injection locate elements by this id.
- Return a plain HTML string. The engine does no post-processing.
- The element's `style` field is **not auto-applied** — you must convert `element.style` to inline CSS yourself (see [Style Helpers](#5-style-helpers) below).
- If your element needs animation targets, give internal parts their own ids (e.g. `<div id="bar-fill">`).

**Example** (SVG chart element):
```js
registerElements() {
  return {
    chart: {
      render(element /*, config */) {
        const id = element.id;
        const w = element.width || 400;
        const h = element.height || 300;
        const data = element.data || [];
        const bars = data.map((d, i) =>
          `<rect id="${id}-bar-${i}" x="${i * 40}" y="${h - d.value}" width="30" height="${d.value}" fill="var(--accent)"/>`
        ).join('');
        return `<svg id="${id}" width="${w}" height="${h}" style="overflow:visible">${bars}</svg>`;
      }
    }
  };
}
```

### 4.3 `afterGenerate(ctx: PluginContext) → void | Promise<void>`

**Timing**: After HTML is written to disk.

**PluginContext**:
```typescript
interface PluginContext {
  config: VideoConfig;    // final config after beforeGenerate processing
  outputDir: string;       // absolute path to output directory (default <cwd>/output)
}
```

**What you can do**:
- Read `outputDir/index.html`, inject additional GSAP tweens into the timeline.
- Append external resources (`<link>` CSS, `<script>` library files, `<svg>` defs).
- Generate auxiliary files in the output directory.
- For modular architecture: process sub-composition files in `outputDir/compositions/*.html`.

**Timeline injection pattern** (the most important `afterGenerate` use case):

The generated `index.html` contains a GSAP timeline ending with this anchor line:

```javascript
window.__timelines["<compositionId>"] = tl;
```

You insert your tweens **before** this line:

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
  console.log('  [my-plugin] injected 1 tween');
}
```

**Modular architecture note**: In modular mode, timelines are spread across `compositions/*.html` sub-files. Each sub-file has the same anchor format but a different `compositionId` (the scene id). To support modular, iterate `ctx.config.subCompositions.scenes` and process each file.

---

## 5. Style Helpers

Built-in elements use two utility functions to process `style` objects. Your plugin's `render()` should follow the same conventions for consistent CSS output.

### 5.1 kebab-case conversion

```js
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
// fontSize → font-size
// borderRadius → border-radius
// zIndex → z-index
```

### 5.2 Auto-append px for length properties

These properties get `px` appended when the value is a number:

```js
const LENGTH_PROPS = new Set([
  'fontSize','maxWidth','width','height','top','left','right','bottom',
  'gap','padding','margin','lineHeight','borderRadius','borderWidth'
]);
```

Properties like `opacity`, `zIndex`, `fontWeight` do **not** get `px` — they are excluded from the set.

### 5.3 Complete `styleStr` helper (copy into your plugin)

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

---

## 6. Schema Bypass Mechanism

j2hf uses JSON Schema (AJV, draft-07) with strict validation. The root object and each built-in element type have `additionalProperties: false` — unknown fields cause errors.

But plugin element types (like `badge`, `chart`, `progress`) are **not** in the schema's `oneOf` union. AJV would normally flag them as "no matching type."

The engine solves this with `collectPluginElementPaths`:

1. During `loadPlugins`, your `registerElements()` has already executed — the registry knows about `badge`.
2. `validateConfig` calls `collectPluginElementPaths(config)`: walks all scene elements recursively; for any element where `globalRegistry.getRenderer(el.type)` returns a hit, records that element's JSON path (e.g. `/scenes/0/elements/1`).
3. After AJV runs, errors under those paths are **discarded**.

**Effect**: your custom elements and their sub-fields won't be blocked by the built-in schema. You can define any field structure you want.

**BUT you must self-validate**: The schema bypass means AJV won't check your fields. Do your own validation in `beforeGenerate`:

```js
beforeGenerate(config) {
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !Array.isArray(el.data)) {
        throw new Error(`[j2hf-chart] Element "${el.id}" is missing required data array`);
      }
    }
  }
  return config;
}
```

**Root-level constraint**: The root object still has `additionalProperties: false`. Custom fields can only live inside **element objects**, not at the config root level.

---

## 7. Complete Real-World Plugin: Chart with All Three Hooks

This plugin registers a `chart` element type that:
1. `beforeGenerate`: validates `data` field, injects default palette
2. `registerElements`: renders an SVG bar chart
3. `afterGenerate`: injects a stagger animation so bars grow from the bottom

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

  // Hook 1: validate + inject defaults before generation
  beforeGenerate(config) {
    for (const scene of config.scenes || []) {
      for (const el of scene.elements || []) {
        if (el.type !== 'chart') continue;
        if (!Array.isArray(el.data)) {
          throw new Error(`[j2hf-chart] Element "${el.id}" missing required data array`);
        }
        if (!el.palette) {
          el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        }
        if (!el.barWidth) el.barWidth = 60;
        if (!el.gap) el.gap = 20;
      }
    }
    return config;
  },

  // Hook 2: register custom element type → SVG bar chart
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
            return `<rect id="${id}-bar-${i}" x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="4" style="transform-origin:${x + barWidth/2}px ${y}px"/>`;
          }).join('');

          const labels = data.map((d, i) => {
            const x = i * (barWidth + gap) + barWidth / 2;
            return `<text x="${x}" y="${h + 20}" text-anchor="middle" fill="var(--foreground)" font-size="14">${d.label || ''}</text>`;
          }).join('');

          const s = styleStr(element.style);
          return `<svg id="${id}" width="${w}" height="${h + 40}"${s ? ` style="${s};overflow:visible"` : ' style="overflow:visible"'}>\n${bars}\n${labels}\n</svg>`;
        }
      }
    };
  },

  // Hook 3: inject stagger grow animation after generation
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
    console.log(`  [j2hf-chart] injected ${lines.length} bar grow animations`);
  }
};
```

**Corresponding config**:

```jsonc
{
  "$schema": "../schemas/video-config.schema.json",
  "compositionId": "chart-demo",
  "width": 1920, "height": 1080, "fps": 30,
  "plugins": ["./j2hf-chart.mjs"],
  "palette": { "background": "#0f172a", "foreground": "#e2e8f0", "accent": "#3b82f6" },
  "scenes": [{
    "id": "s1", "start": 0, "duration": 4,
    "elements": [{
      "type": "chart", "id": "sales-chart",
      "data": [
        { "label": "Q1", "value": 30 },
        { "label": "Q2", "value": 65 },
        { "label": "Q3", "value": 45 },
        { "label": "Q4", "value": 80 }
      ],
      "width": 400, "height": 250,
      "barWidth": 60, "gap": 20,
      "stagger": 0.15, "barDuration": 0.6,
      "style": { "position": "absolute", "top": 400, "left": 200 }
    }]
  }]
}
```

---

## 8. Built-in Capabilities vs Plugin Gaps

Before writing a plugin, check if the built-in types already cover your need. See [element-types.md](./element-types.md) for the full reference.

### Already built-in (no plugin needed)

| Area | Capability |
|------|------------|
| Layout | Absolute positioning, flex containers (group + layout), recursive child rendering |
| Text | Full typography (size / weight / spacing / line-height / align / variant), variable binding |
| Media | Image (with fallback), video (cross-origin / volume), audio (fade in/out) |
| Shapes | Rect / circle / ellipse / line, border, radius |
| Animations | Full GSAP timeline (to / from / fromTo), recursive animation collection, scene background animations |
| Transitions | 6 implemented: crossfade, blur-crossfade, zoom-through, zoom-out, push-slide, color-dip-black |
| Variables | CSS variable declaration and auto-injection |
| Architecture | monolithic (single file) and modular (host + sub-compositions) |

### High-value gaps (plugins should address these)

| Direction | Description | Hooks needed |
|------------|-------------|--------------|
| **Charts** | Bar, line, pie, area charts. Best: `registerElements` for SVG + `afterGenerate` for draw animations | All three |
| **Lottie** | Render `<lottie-player>`, inject lottie-web script + playback control via `afterGenerate` | registerElements + afterGenerate |
| **3D / WebGL** | Render `<canvas>`, inject Three.js code + render loop tied to timeline | registerElements + afterGenerate |
| **Maps** | Render container, inject Leaflet / Mapbox GL init script | registerElements + afterGenerate |
| **QR codes** | Render `<img>` or `<svg>` via `qrcode` npm package synchronously in `registerElements` | registerElements only |

### Medium-value gaps

| Direction | Description | Hooks needed |
|------------|-------------|--------------|
| **More transitions** | 21 of 27 defined types are unimplemented (glitch, ripple, staggered-blocks, clock-wipe, etc.). Implement as `afterGenerate` timeline injection | afterGenerate |
| **Code highlighting** | Render `<pre><code>`, inject highlight.js / Prism via `afterGenerate` | registerElements + afterGenerate |
| **Math formulas** | Render container, inject KaTeX / MathJax via `afterGenerate` | registerElements + afterGenerate |
| **Markdown rendering** | Convert `element.content` Markdown → HTML in `registerElements` synchronously | registerElements |

---

## 9. Publishing a Plugin

### package.json

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

### Entry point

```js
// dist/index.mjs
export default {
  name: 'j2hf-chart',
  beforeGenerate(config) { /* ... */ return config; },
  registerElements() { return { chart: { render(el) { /* ... */ } } }; },
  afterGenerate(ctx) { /* ... */ }
};
```

### TypeScript type imports

```typescript
import type { J2hfPlugin, ElementRenderer, PluginContext, VideoConfig } from 'j2hf';
```

These types are re-exported from `j2hf`'s `dist/lib/generate.d.ts`.

### Publish and use

```bash
npm publish        # publish to npm
npm install j2hf-chart   # users install
```

```jsonc
{ "plugins": ["j2hf-chart"] }
```

---

## 10. Debugging Tips

### Check if plugin is loaded

When running `j2hf generate`, the console prints:

```
• Loaded plugin: j2hf-progress +customElements +beforeGenerate +afterGenerate
```

If you don't see this, the specifier didn't resolve.

### Inspect generated HTML

```bash
j2hf generate
cat output/index.html | grep "your-element-id"
```

### Verify timeline injection

```bash
grep "window.__timelines" output/index.html
# Your tweens should appear before this line
```

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `✗ Failed to load plugin: "xxx"` | npm package not installed / local path wrong | `npm install xxx` or check relative path from cwd |
| `✗ Plugin "xxx" did not export a valid J2hfPlugin (missing .name)` | Export object has no `name` field | Ensure `export default { name: '...', ... }` |
| Element renders as `<!-- Unknown element type: xxx -->` | `registerElements` didn't return that type, or type name is misspelled | Check that the key in `registerElements()` return matches the `type` field in config |
| Validation error on your custom element | The element's type wasn't registered (bypass not triggered) | Confirm plugin loads before `validateConfig` — it registers during `loadPlugins`, which runs first |
| `anchor not found` in afterGenerate | compositionId mismatch, or file isn't `index.html` (modular mode) | Check `ctx.config.compositionId`; for modular, iterate `compositions/*.html` |

---

## 11. Reference Implementation

The repo includes `examples/plugins/j2hf-progress.mjs` — a production-ready minimal plugin using all three hooks. Read it before writing your own.

Corresponding config: `examples/plugin-demo.json`. Run:

```bash
j2hf generate --config examples/plugin-demo.json
j2hf preview
```

---

## 12. API Reference Summary

### J2hfPlugin

```typescript
interface J2hfPlugin {
  name: string;                                                    // required
  beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
  registerElements?: () => Record<string, ElementRenderer>;
  afterGenerate?: (ctx: PluginContext) => void | Promise<void>;
}
```

### ElementRenderer

```typescript
interface ElementRenderer {
  render: (element: any, config: any) => string;
  // element: the JSON element object (has id, style, and your custom fields)
  // config: the entire VideoConfig (type annotation says "scene" but runtime value is config)
  // returns: HTML string
}
```

### PluginContext

```typescript
interface PluginContext {
  config: VideoConfig;    // final config after beforeGenerate
  outputDir: string;       // absolute output directory path
}
```

### Programmatic usage (no CLI)

```typescript
import { loadConfig, generate, globalRegistry } from 'j2hf';
import myPlugin from './my-plugin.mjs';

globalRegistry.register(myPlugin);
const config = loadConfig('video-config.json');
const { files, config: finalConfig } = await generate(config, 'output');
```

---

## 13. Agent Plugin Writing Checklist

- [ ] Confirmed the built-in 7 types don't already cover the need
- [ ] Plugin has `export default { name: '...', ... }`
- [ ] `name` field is present and unique
- [ ] `registerElements()` returns `{ typeName: { render(el, config) → HTML } }`
- [ ] `render()` output includes `id="${element.id}"`
- [ ] `beforeGenerate()` returns `config` (not `undefined`)
- [ ] Style conversion uses the `styleStr` helper (kebab + LENGTH_PROPS)
- [ ] `afterGenerate()` reads `index.html`, finds the anchor, inserts tweens before it
- [ ] Self-validation for custom fields is done in `beforeGenerate()`
- [ ] Config `"plugins"` array references the plugin correctly (npm name or local path)
- [ ] Plugin type name in config matches the key in `registerElements()` return
