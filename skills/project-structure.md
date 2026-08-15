# Skill: Project Structure & Generation Flow

> Map of the j2hf codebase and the end-to-end generation pipeline. Use this to navigate the source code, understand where to make changes, and debug generation issues.

---

## 1. Repository Layout

```
j2hf/
├── src/
│   ├── bin/
│   │   └── j2hf.ts              # CLI entry point (commander.js)
│   └── lib/
│       ├── types.ts             # TypeScript interfaces: VideoConfig, J2hfPlugin, PluginContext, ElementRenderer
│       ├── generate.ts          # Core generation engine (~600 lines)
│       ├── plugin-system.ts     # PluginRegistry class + globalRegistry singleton
│       ├── init.ts              # j2hf init — scaffolds a new project
│       └── utils.ts             # Shared utilities (if present)
│
├── schemas/
│   └── video-config.schema.json # AJV (draft-07) JSON Schema
│
├── templates/
│   └── video-config.json        # Default config template for j2hf init
│
├── examples/
│   ├── demo.json                # Full 3-scene demo (hook → feature → cta)
│   ├── plugin-demo.json         # Minimal plugin usage demo
│   └── plugins/
│       └── j2hf-progress.mjs    # Reference plugin using all 3 hooks
│
├── docs/
│   ├── schema.md                # Complete schema field → HyperFrames mapping (Chinese)
│   ├── plugin-development.md    # Complete plugin dev guide (Chinese)
│   ├── validation.md            # 18 validation invariants (Chinese)
│   ├── cli-reference.md         # CLI command reference (if present)
│   └── architecture.md          # Architecture overview (if present)
│
├── skills/                      # ← This folder: agent skill files
│   ├── README.md                # Skill index
│   ├── writing-video-config.md  # Writing video-config JSON
│   ├── writing-plugins.md       # Writing j2hf plugins
│   ├── element-types.md         # 7 built-in element types reference
│   ├── timeline-animations.md   # Animations, transitions, audio fades
│   ├── validation-rules.md      # 18 validation invariants
│   └── project-structure.md     # ← This file
│
├── package.json                 # j2hf v1.0.4, ESM, Node ≥ 18
├── README.md / README_zh.md     # Project README (EN + ZH)
└── tsconfig.json                # TypeScript config (ESM output)
```

---

## 2. Key Modules

### `src/lib/types.ts` — Type Definitions

All public TypeScript interfaces:

```typescript
export interface VideoConfig {
  width?: number;
  height?: number;
  fps?: number;
  compositionId?: string;
  architecture?: 'monolithic' | 'modular';
  subCompositions?: { scenes?: string[] };
  palette?: { background?: string; foreground?: string; accent?: string; neutral?: string[]; themeRef?: string; };
  typography?: { bodyFont?: string; headlineFont?: string; };
  variables?: { declarations?: Array<{ id: string; type: string; default: any; enum?: any[] }> };
  renderSettings?: { output?: string; quality?: string; fps?: number; strict?: boolean; };
  plugins?: string[];
  [key: string]: any;    // index signature allows additional fields
}

export interface PluginContext {
  config: VideoConfig;
  outputDir: string;
}

export interface ElementRenderer {
  render: (element: any, config: any) => string;
}

export interface J2hfPlugin {
  name: string;
  beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
  registerElements?: () => Record<string, ElementRenderer>;
  afterGenerate?: (ctx: PluginContext) => void | Promise<void>;
}
```

### `src/lib/generate.ts` — Core Engine

The heart of j2hf. Key exported functions:

| Function | Export | Responsibility |
|----------|--------|----------------|
| `loadConfig(configPath)` | named | Read JSON file, `JSON.parse` → config object |
| `loadPlugins(rawConfig)` | named (internal) | Iterate `config.plugins`, dynamic `import()` each, call `globalRegistry.register()` |
| `validateConfig(rawConfig)` | named | AJV schema validation + 18 invariant checks + plugin path bypass |
| `collectPluginElementPaths(config)` | internal | Walk elements, find plugin-registered types, return their JSON paths |
| `generate(rawConfig, outputDir)` | named | Run `beforeGenerate` pipeline → build HTML → `afterGenerate` → return `{ files, config }` |
| `runGenerate(configPath, outputDir?)` | **default** | Full pipeline: loadConfig → loadPlugins → validateConfig → generate |
| `renderElement(el, config)` | internal | Dispatch to plugin renderer (if exists) or built-in 7-type switch |
| `buildTimeline(config)` | internal | Construct the GSAP timeline string from all animation sources |
| `collectAnimLines(elements, sceneStart, lines)` | internal | Recursively collect element animations |
| `buildBackgroundAnims(config)` | internal | Collect background layer animations (absolute `at` time) |
| `buildTransitionAnims(config)` | internal | Generate 6 transition types |
| `buildAudioFades(config)` | internal | Generate audio fade in/out tweens |
| `globalRegistry` | re-exported | The singleton `PluginRegistry` instance |

### `src/lib/plugin-system.ts` — Plugin Registry

```typescript
class PluginRegistry {
  private plugins: J2hfPlugin[] = [];
  private renderers: Map<string, ElementRenderer> = new Map();

  register(plugin: J2hfPlugin): void {
    this.plugins.push(plugin);
    if (plugin.registerElements) {
      const elements = plugin.registerElements();
      for (const [type, renderer] of Object.entries(elements)) {
        this.renderers.set(type, renderer);
      }
    }
  }

  getRenderer(type: string): ElementRenderer | undefined {
    return this.renderers.get(type);
  }

  async runBeforeGenerate(config: VideoConfig): Promise<VideoConfig> {
    let c = config;
    for (const plugin of this.plugins) {
      if (plugin.beforeGenerate) c = await plugin.beforeGenerate(c);
    }
    return c;
  }

  async runAfterGenerate(ctx: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterGenerate) await plugin.afterGenerate(ctx);
    }
  }
}

export const globalRegistry = new PluginRegistry();
```

### `src/bin/j2hf.ts` — CLI Entry

Uses commander.js. Commands:

| Command | Description |
|---------|-------------|
| `j2hf init [dir]` | Scaffold a new project (copies template + installs deps) |
| `j2hf generate --config <path> [--output <dir>]` | Generate HTML from a config |
| `j2hf preview [--dir <path>]` | Serve the output directory for preview |
| `j2hf watch --config <path>` | Watch config file, regenerate on change |

---

## 3. Generation Pipeline (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│                    j2hf generate --config video-config.json     │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
            ┌──────────────────── runGenerate ─────────────────────┐
            │                                                      │
            │  1. loadConfig(configPath)                           │
            │     └─ fs.readFileSync → JSON.parse                   │
            │     → rawConfig (plain object)                        │
            │                                                      │
            │  2. loadPlugins(rawConfig)                             │
            │     └─ for each name in rawConfig.plugins:            │
            │        ├─ try: import(name)         [npm package]     │
            │        └─ catch: import(pathToFileURL(                 │
            │                    path.resolve(cwd, name)).href)      │
            │                   [local file path]                   │
            │     └─ get mod.default or mod                         │
            │     └─ check mod.name exists                           │
            │     └─ globalRegistry.register(plugin)                │
            │        └─ if plugin.registerElements:                  │
            │           call it → store {type: renderer} in Map    │
            │     → console.log("• Loaded plugin: <name> +hooks")  │
            │                                                      │
            │  3. validateConfig(rawConfig)                          │
            │     ├─ collectPluginElementPaths(config)               │
            │     │  └─ for each scene.elements, recursively:        │
            │     │     if globalRegistry.getRenderer(el.type):      │
            │     │       record el's JSON path                      │
            │     ├─ ajv.compile(schema) → validate(rawConfig)       │
            │     │  └─ discard errors under plugin element paths    │
            │     ├─ E001: unique IDs                                 │
            │     ├─ E002: no track overlap                           │
            │     ├─ E003: no circular start refs                    │
            │     ├─ E004: duration within composition               │
            │     ├─ E005: anim whitelist + style restrictions       │
            │     ├─ E006: media src exists                          │
            │     ├─ E007: video audio independence                  │
            │     ├─ W009: WCAG contrast (warning)                   │
            │     ├─ E013-E015: variable declarations               │
            │     ├─ W016: transition preset conflict (warning)     │
            │     ├─ E017: modular completeness                      │
            │     └─ W018: font pairing (warning)                    │
            │     → validated config (or throw on E-error)          │
            │                                                      │
            │  4. generate(rawConfig, outputDir)                    │
            │     ├─ globalRegistry.runBeforeGenerate(config)         │
            │     │  └─ serial pipeline: each plugin's output        │
            │     │     feeds the next plugin's input               │
            │     ├─ resolve scene start references                   │
            │     ├─ build HTML:                                      │
            │     │  ├─ <head> with GSAP CDN, font links             │
            │     │  ├─ <body> with all scenes' elements             │
            │     │  ├─ <style> with CSS variables from palette      │
            │     │  ├─ render each scene's elements recursively     │
            │     │  │  └─ renderElement(el, config):                │
            │     │  │     ├─ plugin renderer? → use it              │
            │     │  │     └─ built-in switch(type):                 │
            │     │  │        text/image/shape/group/video/audio/icon │
            │     │  ├─ buildTimeline(config):                        │
            │     │  │  ├─ collectAnimLines (recursive, sceneStart+delay)│
            │     │  │  ├─ buildBackgroundAnims (absolute `at`)      │
            │     │  │  ├─ buildTransitionAnims (6 types)           │
            │     │  │  └─ buildAudioFades                           │
            │     │  └─ write index.html                              │
            │     │     (or modular: host + compositions/*.html)    │
            │     └─ globalRegistry.runAfterGenerate(ctx)            │
            │        └─ serial: each plugin reads/writes index.html  │
            │                                                      │
            │  5. return { files: string[], config: VideoConfig }  │
            │                                                      │
            └──────────────────────────────────────────────────────┘
```

---

## 4. HTML Output Structure

### Monolithic (default)

```html
<!-- output/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title><!-- compositionId --></title>
  <link href="..." rel="stylesheet"><!-- Google Fonts -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    :root { --background: ...; --foreground: ...; --accent: ...; --neutral-0: ...; }
    body { margin: 0; background: var(--background); }
    .scene { position: absolute; top: 0; left: 0; width: <width>px; height: <height>px; }
    /* element styles */
  </style>
</head>
<body>
  <!-- Scene containers -->
  <div id="scene-hook" class="scene" style="...">
    <div id="hook-title" style="...">Hello World</div>
    <div id="hook-bg" style="..."></div>
  </div>
  <div id="scene-feature" class="scene" style="...">
    ...
  </div>

  <script>
    const tl = gsap.timeline({ paused: true, defaults: { duration: 0.6, ease: "power3.out" } });

    // Element animations
    tl.from("#hook-title", { opacity: 0, y: 80, duration: 1.0, ease: "power4.out" }, 0);

    // Background animations
    tl.from("#hook-bg", { scale: 1.2, duration: 4.0, ease: "sine.inOut" }, 0);

    // Transition animations
    tl.to("#scene-hook", { opacity: 0, duration: 0.5 }, 3.8);

    // Audio fades
    tl.fromTo("#aud-bgm", { volume: 0 }, { volume: 0.7, duration: 0.5 }, 0);

    // Plugin-injected tweens go here (before the anchor)

    window.__timelines["my-comp"] = tl;  // ← ANCHOR
  </script>
</body>
</html>
```

### Modular

```
output/
├── index.html                    # thin host with GSAP + font imports
└── compositions/
    ├── hook.html                 # full <template> for scene "hook"
    ├── feature.html             # full <template> for scene "feature"
    └── cta.html                  # full <template> for scene "cta"
```

Each sub-composition file has its own timeline with a different `compositionId` (the scene id). The host `index.html` loads them as `<template>` tags and instantiates them dynamically.

**Plugin note for modular**: In `afterGenerate`, iterate `ctx.config.subCompositions.scenes` and process each `compositions/<sceneId>.html` file separately.

---

## 5. Where to Make Changes

| If you want to... | Modify this file |
|--------------------|------------------|
| Add a new built-in element type | `src/lib/generate.ts` `renderElement()` switch + `schemas/video-config.schema.json` `$defs` |
| Change validation logic | `src/lib/generate.ts` `validateConfig()` + `docs/validation.md` |
| Change how plugins load | `src/lib/generate.ts` `loadPlugins()` |
| Change plugin hook execution | `src/lib/plugin-system.ts` `PluginRegistry` class |
| Add a CLI command | `src/bin/j2hf.ts` |
| Change the default template | `templates/video-config.json` |
| Update the schema | `schemas/video-config.schema.json` (AJV draft-07) |
| Add transitions | `src/lib/generate.ts` `buildTransitionAnims()` + schema enum |
| Change HTML structure | `src/lib/generate.ts` `generate()` function (the HTML template literal) |
| Change timeline building | `src/lib/generate.ts` `buildTimeline()` + `collectAnimLines()` |

---

## 6. Key Design Decisions

### Why single paused timeline?
All animations live on one paused GSAP timeline per composition. The HyperFrames player controls playback (play, pause, seek). This makes frame-accurate seeking trivial and ensures deterministic rendering — the same timeline always produces the same frames.

### Why plugin element renderers check before built-in?
Plugins are for extensibility. A plugin might want to override `text` rendering (e.g., to add text effects). Checking the plugin registry first gives plugins full power while keeping built-in types as defaults.

### Why is `beforeGenerate` a pipeline?
Config transformations compose naturally as a pipeline. Plugin A injects default palettes → Plugin B validates custom fields → Plugin C fetches remote data. Each plugin sees the output of the previous one.

### Why is `afterGenerate` post-HTML-write?
This lets plugins do powerful things: inject timeline tweens by string manipulation, append `<script>` or `<link>` tags, generate auxiliary files. The downside is that plugins must read/write the file directly — but this is far more flexible than any structured API could be.

### Why does `registerElements` run at registration time, not during `generate`?
The schema bypass (`collectPluginElementPaths`) needs to know which element types are plugin-registered **before** validation runs. Since `loadPlugins` runs before `validateConfig`, registering elements during `register()` ensures the registry is populated before the bypass check.

### Why local path resolution from cwd (not config file location)?
Config files can be shared across projects. Resolving plugin paths from cwd (the command's working directory) is predictable and matches how `npm`-installed packages are resolved. If you need config-relative paths, document the expected directory structure in your project.

---

## 7. Running Locally (Development)

```bash
# Install dependencies
npm install

# Build
npm run build

# Run CLI locally
node dist/bin/j2hf.js init my-project
cd my-project
node ../dist/bin/j2hf.js generate --config video-config.json

# Or link globally
npm link
j2hf init my-project
cd my-project
j2hf generate
j2hf preview

# Run examples
j2hf generate --config examples/demo.json
j2hf generate --config examples/plugin-demo.json
```

---

## 8. Agent Navigation Checklist

When asked to investigate or modify j2hf:

- [ ] Is the question about config JSON? → Read [writing-video-config.md](./writing-video-config.md)
- [ ] Is it about element types? → Read [element-types.md](./element-types.md)
- [ ] Is it about animations/transitions? → Read [timeline-animations.md](./timeline-animations.md)
- [ ] Is it about validation errors? → Read [validation-rules.md](./validation-rules.md)
- [ ] Is it about plugins? → Read [writing-plugins.md](./writing-plugins.md)
- [ ] Is it about where a feature is implemented? → Check the [Where to Make Changes](#5-where-to-make-changes) table above
- [ ] Is it about the generation pipeline? → Re-read [§3 Generation Pipeline](#3-generation-pipeline-end-to-end)
- [ ] Need the full schema? → Read `schemas/video-config.schema.json`
- [ ] Need a working example? → Read `examples/demo.json` or `examples/plugin-demo.json`
- [ ] Need a reference plugin? → Read `examples/plugins/j2hf-progress.mjs`
