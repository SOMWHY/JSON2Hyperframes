# JSON2Hyperframes

[English](README.md) | [简体中文](README_zh.md)

Turn a JSON video config into [HyperFrames](https://hyperframes.heygen.com) HTML compositions and render them to MP4.

## Why this exists?

1. **AI-era Interface (LLM-Friendly)**:
   Let an LLM generate hundreds of lines of complex Hyperframes HTML + GSAP animations. The hallucination rate is extremely high and difficult to control. But it is much simpler and far more stable for an LLM to generate a schema-compliant `video-config.json` that defines the scenes, text, color palette, and characters. This project is a core building block of the AI video generation pipeline (AIGC Video Pipeline).

2. **Batch Production (Automation)**:
   For example, a merchant may need to generate 10,000 short videos for 10,000 products, each featuring product images and prices. It is impossible to manually write 10,000 HTML files, but it is easy to render 10,000 JSON files from database data and then use this CLI to generate and render them in batch.

## CLI Usage

```bash
# Install globally
npm install -g j2hf

# Create a new project
j2hf init my-video
cd my-video

# Generate HyperFrames HTML from video-config.json
j2hf generate

# Preview in browser
j2hf preview

# Render to MP4
j2hf render
```

Or use `npx` without installing:

```bash
npx j2hf init my-video
cd my-video
npx j2hf generate
npx j2hf preview
```

## Commands

| Command | Description |
|---------|-------------|
| `j2hf init [projectName]` | Create a new project with interactive or inline name |
| `j2hf generate [--config=PATH]` | Generate HyperFrames HTML (monolithic or modular) |
| `j2hf preview [--force-new]` | Start preview server |
| `j2hf render [--output=FILE]` | Render MP4, saved to `videos/` |

## Architecture

- **Monolithic** (default): single `output/index.html` with all scenes and one timeline
- **Modular**: thin host `index.html` + one sub-composition `.html` per scene in `output/compositions/`

Set `"architecture": "modular"` in `video-config.json` with a `subCompositions.scenes` array.

## Configuration

Edit `video-config.json` to define scenes, elements, animations, palette, variables, and audio.

Schema: `schemas/video-config.schema.json`

## Plugins

The core is minimal and render-only — it doesn't do charts, Lottie, 3D, maps, QR codes, or resource subsetting. Those gaps are intentional: they belong to plugins. Third-party developers can extend the engine at three points:

| Hook | When it runs | What it's for |
|------|-------------|---------------|
| `beforeGenerate(config)` | After loading config, before validation | Fetch data from an API/database, inject defaults, normalize a half-finished LLM config into schema-compliant shape |
| `registerElements()` | Right after load | Return a `{ type: renderer }` map to add custom element types. Plugin renderers are checked **before** the built-in 7 (text/image/shape/group/video/audio/icon), so they override or add |
| `afterGenerate(ctx)` | After files are written | Generate side artifacts (thumbnails, SRT, manifest), compress/inline assets, upload to a CDN or CMS |

A plugin is a plain module (ESM default export or CJS `module.exports`) that satisfies the `J2hfPlugin` interface in `src/lib/types.ts`:

```js
// my-plugin.mjs
export default {
  name: 'my-plugin',
  beforeGenerate(config) { return config; },        // optional
  registerElements() {                            // optional
    return {
      'chart': { render: (el, scene) => '<div ...></div>' }
    };
  },
  afterGenerate(ctx) { /* ... */ }                 // optional
};
```

Activate it by listing its specifier in your `video-config.json` — an npm package name, or a local file path resolved from your project root:

```json
{
  "plugins": ["j2hf-chart", "./plugins/my-plugin.mjs"]
}
```

Then run `j2hf generate` as usual. The loader fetches and registers each plugin before schema validation, so plugin-registered element types pass validation (their subtree is excluded from the built-in `elementUnion` oneOf check) and `beforeGenerate` hooks fire before rendering.

A working example ships in `examples/plugin-demo.json` + `examples/plugins/j2hf-progress.mjs` — it registers a `progress` element type, renders a track + fill bar, and injects a GSAP tween to animate the fill. Run it with:

```bash
node dist/j2hf.js generate --config=examples/plugin-demo.json
```

## Development (this repo)

```bash
npm install
node bin/j2hf.mjs init demo
node bin/j2hf.mjs generate --config=demo/video-config.json
```

## License

ISC