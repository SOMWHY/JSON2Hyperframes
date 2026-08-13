# JSON2Hyperframes Schema Documentation

[English](schema_en.md) | [简体中文](schema.md)

## Field ↔ HyperFrames Contract Mapping Table

> This table defines how each field in `video-config.json` maps to the HyperFrames composition runtime
> (`data-*` attributes, CSS classes, timeline, track, sub-composition, etc.).

### Top-Level Fields

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `compositionId` | `data-composition-id` attribute + `window.__timelines["<id>"]` key | The three must match. Each sub-composition file in a modular architecture must also follow this. |
| `width` | `data-width` (composition root attribute) | Render frame width |
| `height` | `data-height` (composition root attribute) | Render frame height |
| `duration` | `data-duration` (composition root attribute) | Total duration; must be ≥ sum of scene durations |
| `fps` | `data-fps` | Frame rate, default is 30 |
| `title` | Metadata (page `<title>`) | Used only for documentation and preview |
| `language` | `<html lang="…">` | Default is `zh-CN` |

### Palette

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `palette.background` | `--background` CSS variable + `#root` background-color | Root background color |
| `palette.foreground` | `--foreground` CSS variable | Text foreground color |
| `palette.accent` | `--accent` CSS variable | Accent color |
| `palette.neutral` | `--neutral-0` ~ `--neutral-7` CSS variables | Neutral color scale |
| `palette.themeRef` | References a house-style preset | Presets provide default values, overridden by explicit values in JSON |

### Typography

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `typography.headlineFont` | Main headline `font-family` | Select from 18 preset font families |
| `typography.headlineWeight` | Main headline `font-weight` | Default is "900" |
| `typography.bodyFont` | Body text `font-family` | Must pair with headlineFont across font families |
| `typography.bodyWeight` | Body text `font-weight` | Default is "400" |
| `typography.monoFont` | Monospace text `font-family` | For code/numbers/statistics |
| `typography.headlineSizeMin` | Minimum font size for display | Fullscreen scenes. In-feed is ×1.5 |
| `typography.bodySizeMin` | Minimum font size for body | Same as above |
| `typography.letterSpacing` | `letter-spacing` (em) | Tightens display font sizes |

### Animation Defaults

| JSON Field | GSAP Mapping | Description |
|---|---|---|
| `animationDefaults.duration` | `gsap.defaults({ duration })` | Default is 0.6s |
| `animationDefaults.ease` | `gsap.defaults({ ease })` | Default is `power3.out` |
| `animationDefaults.overwrite` | `gsap.defaults({ overwrite })` | Default is `"auto"` |
| `animationDefaults.immediateRender` | `gsap.defaults({ immediateRender })` | Default is `true` |

### Transitions

| JSON Field | Implementation Mechanism | Description |
|---|---|---|
| `transitions.default.type` | Insert the next scene's clip early (`start - overlap`) + different track | Transitions are driven by overlapping two clips |
| `transitions.default.preset` | Predefined duration/ease combination | See preset quick reference table |
| `transitions.byScene.<id>` | Override default transition by scene | The key is scene.id |
| Transition duration | Overlap duration of two scene clips | The next scene's `start` is advanced by overlap seconds |
| Transition ease | Easing of exit/entry animations | Used uniformly for both directions |

**First-exit-then-entry pattern (jump cut / dip to color) is forbidden.** Transitions are achieved by overlapping two scene clips and driving exit/entry animations simultaneously on the timeline.

### Variables

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `variables.declarations[].id` | Variable name (used as `var-*` suffix) | Required |
| `variables.declarations[].type` | Type constraint | `string`/`color`/`number`/`boolean`/`enum`/`image`/`file` |
| `variables.declarations[].default` | Variable default value | Overridden by values at render time |
| `variables.values` | `data-variable-values` (JSON string) | Overrides declarations default at render time |
| Element `varBindings` | `data-var-text` / `data-var-src` etc. attributes | Binds elements to variables |

### Shared Background Layer

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `background.id` | `<div id="<id>">` | Not a clip — no `data-start`/`data-duration`/`data-track-index` |
| `background.style` | Inline style | Visible throughout the video |
| `background.animations[].to` | `tl.to("#<id>", { … }, at)` | Drives changes to the background state |
| `background.animations[].at` | Timeline position | Absolute seconds |

### Scenes (scene = clip)

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `scene.id` | `<section id="<id>" class="clip">` | Unique global ID |
| `scene.start` | `data-start` | Absolute seconds or relative reference. References are resolved in the generator |
| `scene.duration` | `data-duration` | Seconds |
| `scene.trackIndex` | `data-track-index` | Default is 1. track 0 is reserved for composition root |
| `scene.background` | Inline style on the element | `null` = transparent (shared background shows through) |
| `scene.zIndex` | CSS `z-index` | Visual hierarchy level |
| `scene.transitionIn` | Transition configuration | Overrides `transitions.byScene` or `transitions.default` |
| `scene.layoutAudit` | `data-layout-*` attributes | See layoutAudit table |

**Clips must be direct children of the composition root.** If wrappers are needed, place them inside the clip.

### Elements (Common Fields)

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `element.id` | `id` attribute | Unique within the scene (prefixed with sceneId- under modular architecture) |
| `element.style` | Inline style on the element | camelCase. **transform is forbidden** |
| `element.layoutAudit` | `data-layout-*` attributes | See layoutAudit table |
| `element.varBindings` | `data-var-*` attributes | Keys are `varText`, `varSrc`, `varHref`, `varAlt` |
| `element.animations` | `tl.to/from/fromTo` calls | Array, each item is a tween |
| `element.hidden` | `data-hidden` attribute | Hidden in both preview and render, reversible |

### Element Types

#### text

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `content` | Element innerText | `<br>` is forbidden |
| `typography` | Partially overrides global typography | Font, size, weight, color, alignment, etc. |
| `textEffect` | Text animation preset | Named preset or raw pass-through |

#### image

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `src` | `<img src>` | Path |
| `fit` | `object-fit` | Default is `cover` |
| `radius` | `border-radius` | px |
| `fallbackSrc` | `onerror` fallback | Required when varSrc is bound |

#### shape

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `kind` | CSS styles (`border-radius: 50%` etc.) | `rect`/`circle`/`ellipse`/`line` |
| `backgroundColor` | `background-color` | Color value |
| `border` | `border` shorthand | Width/color/style |
| `radius` | `border-radius` | Only for rect/ellipse |

#### video

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `src` | `<video src>` | Path |
| `mediaStart` | `data-media-start` | Offset seconds |
| `volume` | `data-volume` | Static baseline |
| `hasAudio` | `data-has-audio` | Requires an independent `<audio>` element |
| `crossOrigin` | `crossorigin` | Optional |

The generator automatically adds `muted playsinline`. **`class="clip"` is not needed** (framework directly manages visibility).

#### audio

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `src` | `<audio src>` | Must be an independent element even if src is the same as video |
| `volume` | `data-volume` | Static baseline |
| `mediaStart` | `data-media-start` | Offset seconds |

#### group

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `layout` | CSS `display` + `position` | `absolute`/`flex`/`grid` |
| `direction` | `flex-direction` | Only for flex layout |
| `gap` | `gap` | px |
| `align` | `align-items` | — |
| `justify` | `justify-content` | — |
| `padding` | `padding` | px |
| `children` | Array of child elements | Recurse nesting of groups is allowed |

The group itself does not participate in animation. Animations target its child elements or internal wrappers.

#### icon

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `kind` | Registry/catalog name or SVG path | Optional in v1 |
| `size` | `width` + `height` | px |
| `color` | `fill` or `color` | Color value |

### Audio Tracks

| JSON Field | HyperFrames Mapping | Description |
|---|---|---|
| `audioTracks[].id` | `<audio id="<id>">` | Independent element |
| `audioTracks[].src` | `src` attribute | Path |
| `audioTracks[].start` | `data-start` | Absolute seconds |
| `audioTracks[].duration` | `data-duration` | Can be omitted = full length of media |
| `audioTracks[].trackIndex` | `data-track-index` | Default is 10 (keeps away from visual tracks) |
| `audioTracks[].volume` | `data-volume` | Static baseline |
| `audioTracks[].fades[].at` | `tl.to("#<id>", { volume: to }, at)` | Volume animation on the timeline |

### layoutAudit Attributes

| JSON Field | `data-*` Attribute | Description |
|---|---|---|
| `allowOverflow` | `data-layout-allow-overflow` | Allows content overflow |
| `bleed` | `data-layout-bleed` | Bleed margin reservation |
| `ignore` | `data-layout-ignore` | Skip layout check |
| `allowCaptionZone` | `data-layout-allow-caption-zone` | Allows caption zone |

---

## Architecture: monolithic vs modular

### Monolithic (Default)

```
index.html
├── <style>/* All styles */
├── <section class="clip" id="hook" data-start="0" data-duration="4" data-track-index="1">
│   └── Elements
├── <section class="clip" id="feature" data-start="3.8" data-duration="4.5" data-track-index="2">
│   └── Elements
└── <script>
    const tl = gsap.timeline({ paused: true });
    tl.to("#hook-title", { opacity: 1, duration: 1 });
    // ... All animations on a single timeline
    window.__timelines["main"] = tl;
    </script>
```

### Modular (architecture: "modular")

```
index.html (Thin orchestrator)
├── <style>/* Global styles */
├── <div data-composition-src="compositions/hook.html"></div>
├── <div data-composition-src="compositions/feature.html"></div>
└── <script>
    // Nearly empty root timeline (only global bg/audio fade)
    // Scene timelines are loaded from sub-composition files
    </script>

compositions/hook.html
├── <template>
│   ├── <style>
│   ├── <section class="clip" id="hook" data-start="0" data-duration="4" data-track-index="1">
│   │   └── Elements
│   └── <script>
│       const tl = gsap.timeline({ paused: true });
│       // Scene animations
│       window.__timelines["hook"] = tl;
│       </script>
</template>
```

### 3 Sub-composition Pitfall Rules (plus 1 ID prefix rule)

| # | Rule | Consequence of Violation |
|---|---|---|
| 1 | Put all `<style>`/`<script>`/`markup` **inside** `<template>` | Runtime only clones template content; external content is lost |
| 2 | Host slot `data-composition-id` == file internal `data-composition-id` == `window.__timelines["<id>"]` key | The three must match exactly, otherwise the timeline cannot be found |
| 3 | Root element styles must use the `#root` selector (cannot use class selector) | CSS scoping turns `.class` into `[data-composition-id] .class`, which fails to match the root itself |
| 4 | Internal element IDs must be prefixed with `<sceneId>-` | Prevents ID conflicts across files |

---

## Preset 18 Font Families

> Zero network request presets. Recommended pairings marked with ✓ (cross-family pairing), ⚠ (use with caution), ✗ (forbidden).

### Preset Sans Serif Families

| Name | Recommended Pairing | Description |
|---|---|---|
| Montserrat | ✓ with EB Garamond/Bodoni Moda etc. | Geometric sans-serif ⭐ Recommended |
| Oswald | ✓ with Playfair Display/Cinzel | Narrow display font |
| League Gothic | ✓ with EB Garamond | Compact condensed font |
| Archivo Black | ✓ with EB Garamond | Extremely bold sans-serif |
| Inter | ✗ Forbidden | Overused, lacks visual impact |
| Roboto | ✗ Forbidden | Android default, generic |
| Open Sans | ✗ Forbidden | Overused |
| Lato | ✗ Forbidden | Overused |
| Nunito | ✗ Forbidden | Rounded fonts are too friendly |
| Poppins | ✗ Forbidden | Overused |
| Outfit | ✗ Forbidden | Overused |
| Sora | ✗ Forbidden | Low contrast |

### Preset Monospace Families

| Name | Recommended Pairing | Description |
|---|---|---|
| Space Mono | ✓ with Montserrat | Monospace display font |
| IBM Plex Mono | ✓ with Montserrat | Monospace font |
| JetBrains Mono | ✓ Recommended | Code ligatures |
| Source Code Pro | ✓ with Montserrat | Classic monospace |

### Preset Serif Families

| Name | Recommended Pairing | Description |
|---|---|---|
| EB Garamond | ✓ Recommended | Not recommended for body copy (too thin in video) |
| Playfair Display | ✓ Default | Recommended to pair with Montserrat |
| Bodoni Moda | ✓ with Montserrat | Modern serif |
| Cinzel | ✓ with Oswald | Roman capitals |
| Prata | ✓ with Montserrat | Transitional serif |
| Syne | ✓ with Montserrat | Variable serif |
| Cormier Garamond | ✗ Forbidden | Too thin for video |

### Preset CJK Families

| Name | Recommended Pairing | Description |
|---|---|---|
| Noto Sans JP | ✓ with Montserrat | Japanese. Acceptable for Chinese |
| Noto Sans SC | ✓ Recommended | Simplified Chinese body text |

> * Note: These fonts are marked as "forbidden" specifically for video body text scenes; headlines can still use them as needed.

### Recommended Pairings

| Headline | Body Text | Scene / Vibe |
|---|---|---|
| Montserrat 900 | EB Garamond 400 | ⭐ General Recommendation |
| Oswald 700 | Playfair Display 400 | Modern / Tech feel |
| League Gothic 800 | EB Garamond 400 | Compact impact |
| Archivo Black 900 | Noto Sans SC 400 | Chinese scenes |
| Space Mono 700 | EB Garamond 400 | Tech / Code style |

---

## Transition Catalog Quick Reference

### Push/Slide Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `push-slide` | Horizontal slide | Chapter transitions |
| `vertical-push` | Vertical slide | Depth narrative |
| `elastic-push` | Elastic slide | Playful branding |
| `squeeze` | Squeeze transition | Compact rhythm |

### Zoom Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `zoom-through` | Zoom through | Impactful entry |
| `zoom-out` | Zoom out | Reveal full picture |
| `gravity-drop` | Gravity drop | Product showcase |

### Reveal Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `circle-iris` | Circular expansion | Focus / Reveal |
| `diamond-iris` | Diamond expansion | High-end / Delicate |
| `diagonal-split` | Diagonal split | Contrast / Juxtaposition |
| `clock-wipe` | Clock wipe | Timing / Progress |
| `shutter` | Shutter | Rhythmic cuts |

### Dissolve Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `crossfade` | Crossfade | ⭐ General default |
| `blur-crossfade` | Blur crossfade | Soft transition |
| `focus-pull` | Focus pull | Depth of field / Layers |
| `color-dip-black` | Dip to black | Strong pause |

### Pattern Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `staggered-blocks` | Staggered blocks | Modern / Dynamic |
| `horizontal-blinds` | Horizontal blinds | Splitting / Reorganization |
| `vertical-blends` | Vertical blends | Juxtaposition / Contrast |

### Effect Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `light-leak` | Light leak | Nostalgic / Cinematic |
| `overexposure-burn` | Overexposure burn | Flashback / Dream |
| `film-burn` | Film burn | Retro / Gritty |

### Distortion Category

| Type | Effect | Applicable Scene |
|---|---|---|
| `glitch` | Glitch effect | Tech / Error |
| `chromatic-aberration` | Chromatic aberration | Glitch / Tech |
| `ripple` | Ripple | Water / Reflection |
| `vhs-tape` | VHS tape | Retro / Low-fi |

### Preset Parameters

| preset | duration | ease | Applicable Scene |
|---|---|---|---|
| snappy | 0.2s | power4.inOut | Fast rhythm |
| **smooth** | **0.4s** | **power2.inOut** | ⭐ General default |
| gentle | 0.6s | sine.inOut | Soft / Documentary |
| dramatic | 0.5s | power3.in → out | Impact / Climax |
| instant | 0.15s | expo.inOut | Flash cut |
| luxe | 0.7s | power1.inOut | High-end / Slow tempo |

---

## Deterministic Rules Summary

### Safety

| # | Rule | Verification |
|---|---|---|
| 1 | `repeat: -1` is forbidden | Schema `minimum: 0` |
| 2 | Animation attributes limited to whitelist | `animatableProperty` enum |
| 3 | `transform` is forbidden in style | `camelCaseStyle` patternProperties |
| 4 | `visibility`/`display` animations are forbidden | Same as above |
| 5 | `display`/`visibility` in style are forbidden | Same as above |

### Timing

| # | Rule | Verification |
|---|---|---|
| 6 | Clips on the same track must not overlap | Interval sorting check |
| 7 | Exit animation allowed on the last scene only | Exit of other scenes is expressed by transition |
| 8 | Transition cannot exit before entering | Implemented by overlapping two clips |

### Structure

| # | Rule | Verification |
|---|---|---|
| 9 | Clip must be a direct child of the composition root | Generator fixed contract |
| 10 | Root must have `data-start="0"` | Generator fixed contract |
| 11 | Single paused timeline registered under `window.__timelines[...]` | Generator fixed contract |
| 12 | Audio from the same source must use separate `<audio>` elements | Structural verification |
| 13 | Video automatically gets `muted playsinline` | Generator fixed contract |

### Variables

| # | Rule | Verification |
|---|---|---|
| 14 | keys in values must exist in declarations | Code validator |
| 15 | Type of values must match declaration | Code validator |
| 16 | enum value must be within options | Code validator |

### Typography

| # | Rule | Verification |
|---|---|---|
| 17 | headline ≥ 700 vs body ≤ 400 | Video requires extreme contrast |
| 18 | Headline and body fonts must pair cross-family | Documentation suggestion, not enforced |
| 19 | Text color and background color ≈ WCAG AA | Contrast ratio algorithm |

---

## Stagger Shapes Reference

| Shape | Description | Configuration |
|---|---|---|
| Linear | Element by element sequence | `{ "stagger": 0.1 }` |
| From Center | Outward from middle | `{ "stagger": { "from": "center", "each": 0.05 } }` |
| From Edges | Inward from both sides | `{ "stagger": { "from": "edges", "each": 0.05 } }` |
| Random | Random order | `{ "stagger": { "from": "random", "each": 0.1 } }` |
| Grid Rows | Row first, then column | `{ "stagger": { "grid": "auto", "axis": "x" } }` |
| Grid Columns | Column first, then row | `{ "stagger": { "grid": "auto", "axis": "y" } }` |

---

## Ease Names Table

### Named Power Eases

| Name | GSAP Mapping | Curve Description |
|---|---|---|
| `power1.out` | `power1.out` | Slight ease out |
| `power2.out` | `power2.out` | Moderate ease out |
| `power3.out` | `power3.out` | ⭐ Default, strong ease out |
| `power4.out` | `power4.out` | Extreme ease out |
| `power1.inOut` | `power1.inOut` | Slight ease in-out |
| `power2.inOut` | `power2.inOut` | Moderate ease in-out, transition default |
| `power3.inOut` | `power3.inOut` | Strong ease in-out |
| `power4.inOut` | `power4.inOut` | Extreme ease in-out |
| `power1.in` | `power1.in` | Slight ease in |
| `power2.in` | `power2.in` | Moderate ease in |
| `power3.in` | `power3.in` | Strong ease in |
| `power4.in` | `power4.in` | Extreme ease in |

### Special Eases

| Name | GSAP Mapping | Description |
|---|---|---|
| `back.out(N)` | `back.out(N)` | Retracts before proceeding, N=1.7 default |
| `elastic.out(N, P)` | `elastic.out(N, P)` | Elastic oscillation |
| `bounce.out` | `bounce.out` | Bounces at the end |
| `steps(N)` | `steps(N)` | Frame-by-frame animation |
| `sine.inOut` | `sine.inOut` | Sine ease in-out (gentle) |
| `circ.inOut` | `circ.inOut` | Circular ease in-out |
| `expo.out` | `expo.out` | Exponential ease out (starts fast) |
| `expo.inOut` | `expo.inOut` | Exponential ease in-out |
| `none` | `none` | Linear (no easing) |
| CSS Bezier | `M0,0 C0.25,0.1 0.25,1 1,1` | Custom bezier curve |
