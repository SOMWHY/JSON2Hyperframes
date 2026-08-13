# JSON2Hyperframes

[English](README.md) | [简体中文](README_zh.md)

Turn a JSON video config into [HyperFrames](https://hyperframes.heygen.com) HTML compositions and render them to MP4.

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

## Development (this repo)

```bash
npm install
node bin/j2hf.mjs init demo
node bin/j2hf.mjs generate --config=demo/video-config.json
```

## License

ISC