# Skill: Write video-config JSON

> This skill guides an Agent through writing a schema-compliant `video-config.json` from scratch.
>
> **Prerequisite reading**: [element-types.md](./element-types.md) · [timeline-animations.md](./timeline-animations.md)

---

## 1. Minimal Config Skeleton

```jsonc
{
  "$schema": "../schemas/video-config.schema.json",
  "schemaVersion": "1.0",
  "compositionId": "my-video",     // REQUIRED, globally unique id
  "width": 1920,                    // REQUIRED, canvas width
  "height": 1080,                   // REQUIRED, canvas height
  "fps": 30,                        // optional, default 30
  "duration": 10,                   // optional, total length in seconds, ≥ max scene end
  "title": "My Video",
  "language": "zh-CN",

  "palette": { ... },              // optional, color system
  "typography": { ... },           // optional, font system
  "animationDefaults": { ... },    // optional, animation defaults
  "variables": { ... },            // optional, variable declarations
  "background": { ... },           // optional, shared background layer
  "audioTracks": [ ... ],          // optional, audio tracks
  "transitions": { ... },          // optional, transition config
  "architecture": "monolithic",    // optional, default monolithic
  "plugins": [ ... ],              // optional, plugin list
  "renderSettings": { ... },       // optional, render settings
  "storyboard": { ... },           // optional, storyboard metadata

  "scenes": [ ... ]                // REQUIRED, array of scenes
}
```

## Required Root Fields

| Field | Type | Notes |
|-------|------|-------|
| `compositionId` | string | Pattern `^[a-zA-Z_][a-zA-Z0-9_-]*$`. Used for timeline registration in `window.__timelines[compositionId]`. |
| `width` | integer ≥ 1 | Canvas width, default 1920. |
| `height` | integer ≥ 1 | Canvas height, default 1080. |
| `scenes` | array ≥ 1 | At least one scene. |

The root object has `additionalProperties: false`. No unknown fields are allowed at the root level — all custom data must live inside **element objects** or be handled via plugins.

---

## 2. Color System (palette)

```jsonc
"palette": {
  // Option A: specify three core colors + optional neutrals
  "background": "#0b0f14",
  "foreground": "#e8eaed",
  "accent": "#66d9ef",
  "neutral": ["#1a2233", "#2a3040", "#3d4556", "#5a6380"],  // 1-8 items
  "themeRef": "dark-premium"   // optional, references a preset theme name

  // Option B: reference a theme only
  // "themeRef": "dark-premium"   // three colors fall back to preset defaults
}
```

**Rules**:
- `anyOf`: either provide `themeRef`, or provide `background` + `foreground` + `accent`.
- Each color becomes a CSS variable: `--background`, `--foreground`, `--accent`, `--neutral-0`, `--neutral-1`, …
- Reference these in element `style` via `var(--accent)`.
- Color values must be hex (`#rgb` / `#rrggbb` / `#rrggbbaa`), `rgb()`, `hsl()`, or a named CSS color.

---

## 3. Typography System (typography)

```jsonc
"typography": {
  "headlineFont": "Montserrat",    // REQUIRED
  "headlineWeight": "900",          // optional, headlines recommended ≥ 700
  "bodyFont": "EB Garamond",       // REQUIRED
  "bodyWeight": "400",             // optional, body recommended ≤ 400
  "monoFont": "JetBrains Mono",    // optional
  "headlineSizeMin": 72,           // optional, default 60, min 30
  "bodySizeMin": 24,               // optional, default 20, min 12
  "letterSpacing": -0.02           // optional, default -0.03, range [-0.1, 0.1]
}
```

**Font pairing rules** (W018 warning):
- Headline and body fonts **must be cross-family**: sans ↔ serif, sans ↔ mono, or serif ↔ sans.
- Same-family pairing triggers a W018 warning.
- Disabled fonts: `Inter`, `Roboto` → triggers E018 error.

**Recommended pairings**:

| Headline | Body | Style |
|----------|------|-------|
| Montserrat 900 | EB Garamond 400 | Classic business |
| Oswald 700 | Playfair Display 400 | Magazine |
| Archivo Black 900 | Noto Sans SC 400 | CJK content |
| JetBrains Mono 700 | EB Garamond 400 | Technical |

**Available font catalog**:

| Family | Fonts |
|--------|-------|
| Sans | Montserrat ⭐ · Oswald · League Gothic · Archivo Black |
| Serif | EB Garamond · Playfair Display ⭐ · Bodoni Moda · Cinzel · Prata · Syne |
| Mono | Space Mono · IBM Plex Mono · JetBrains Mono ⭐ · Source Code Pro |
| CJK | Noto Sans JP · Noto Sans SC |

**Font weight** accepts: `100`–`900` · `bold` · `normal` · `light` (pattern: `^(100|200|300|400|500|600|700|800|900|bold|normal|light)$`).

---

## 4. Animation Defaults (animationDefaults)

```jsonc
"animationDefaults": {
  "duration": 0.6,           // default 0.6s, minimum 0.01
  "ease": "power3.out",      // default power3.out
  "overwrite": "auto",       // default auto
  "immediateRender": true    // default true
}
```

These become the GSAP timeline's `defaults` object. Individual tweens can override any of these values.

---

## 5. Variable System (variables)

```jsonc
"variables": {
  "declarations": [
    {
      "id": "title",           // REQUIRED, pattern ^[a-zA-Z_][a-zA-Z0-9_-]*$
      "type": "string",        // REQUIRED: string|color|number|boolean|enum|image|file
      "label": "Main Title",   // REQUIRED, human-readable label
      "default": "Hello",      // REQUIRED, default value
      "maxLength": 20          // optional, for type=string
    },
    {
      "id": "accent",
      "type": "color",
      "label": "Accent Color",
      "default": "#66d9ef"
    },
    {
      "id": "count",
      "type": "number",
      "label": "User Count",
      "default": 100000,
      "min": 0, "max": 9999999, "step": 1000   // optional numeric constraints
    },
    {
      "id": "tone",
      "type": "enum",
      "label": "Tone",
      "default": "formal",
      "options": [              // REQUIRED for enum, ≥ 1 item
        { "value": "formal", "label": "Formal" },
        { "value": "casual", "label": "Casual" }
      ]
    }
  ],
  "values": {                   // optional, runtime overrides for defaults
    "title": "Hello",
    "accent": "#66d9ef"
  }
}
```

**Variable binding** (used on elements):

```jsonc
{
  "type": "text",
  "id": "my-text",
  "content": "{{title}}",
  "varBindings": {
    "varText": "title"         // outputs data-var-text="title" for HyperFrames variable system
  }
}
```

Available `varBindings` keys: `varText` (text content), `varSrc` (image source), `varHref` (hyperlink), `varAlt` (alt text).

**Validation rules**:
- E013: Every key in `values` must exist in `declarations`.
- E014: Each `values` entry must match its declaration's type.
- E015: `enum` values must be in `options[].value`.

---

## 6. Shared Background Layer (background)

The background layer is visible throughout the entire composition. It is **not** a clip (no `data-start`/`duration`). Scenes are transparent by default to let it show through.

```jsonc
"background": {
  "id": "bg-gradient",                  // REQUIRED
  "style": {
    "backgroundColor": "#0b0f14"
  },
  "animations": [                       // optional, background state changes
    {
      "to": { "backgroundColor": "#0a1530" },
      "at": 4,                          // REQUIRED, absolute time in seconds
      "duration": 3,
      "ease": "sine.inOut"
    }
  ]
}
```

Key point: background animation `at` is an **absolute time** on the composition timeline, not relative to any scene.

---

## 7. Audio Tracks (audioTracks)

```jsonc
"audioTracks": [
  {
    "id": "bgm",                        // REQUIRED
    "src": "assets/bgm.mp3",           // REQUIRED
    "start": 0,                         // optional, default 0
    "duration": 12,                     // optional
    "trackIndex": 10,                   // optional, default 10
    "volume": 0.6,                      // optional, default 1, range [0, 1]
    "fades": [                          // optional, volume fade events
      { "at": 10.5, "to": 0, "duration": 1.5, "ease": "power2.in" }
    ]
  }
]
```

**Rules**:
- `fades[].at` is absolute timeline time.
- `fades[].to` range [0, 1], `fades[].duration` minimum 0.01.

---

## 8. Transition Configuration (transitions)

```jsonc
"transitions": {
  "default": {
    "type": "crossfade",
    "preset": "smooth"
  },
  "byScene": {
    "hook": {
      "type": "zoom-through",
      "preset": "dramatic"
    }
  }
}
```

You can also specify a transition per-scene via `transitionIn`:

```jsonc
{
  "id": "feature",
  "transitionIn": {
    "type": "zoom-through",
    "duration": 0.5,    // mutually exclusive with preset
    "ease": "power4.inOut"
  }
}
```

**6 implemented transition types** (21 more are defined in the schema but require plugin implementation):

| Type | Effect |
|------|--------|
| `crossfade` | Previous scene fades out |
| `blur-crossfade` | Blur fade out (currently same as crossfade) |
| `zoom-through` | Previous scene scales down + fades out |
| `zoom-out` | Same as zoom-through |
| `push-slide` | Previous scene slides left, new scene enters from right |
| `color-dip-black` | Previous scene goes black then fades out |

**Presets** (`preset` is mutually exclusive with `duration`/`ease`):

| Preset | Duration | Ease |
|--------|----------|------|
| `snappy` | 0.2 | power4.inOut |
| `smooth` | 0.4 | power2.inOut (default) |
| `gentle` | 0.6 | sine.inOut |
| `dramatic` | 0.8 | power3.inOut |
| `instant` | 0.1 | power2.out |
| `luxe` | 0.5 | expo.inOut |

All 27 defined transition types (only 6 are currently implemented; the rest require plugins):
`push-slide`, `vertical-push`, `elastic-push`, `squeeze`, `zoom-through`, `zoom-out`, `gravity-drop`, `circle-iris`, `diamond-iris`, `diagonal-split`, `clock-wipe`, `shutter`, `crossfade`, `blur-crossfade`, `focus-pull`, `color-dip-black`, `staggered-blocks`, `horizontal-blinds`, `vertical-blends`, `light-leak`, `overexposure-burn`, `film-burn`, `glitch`, `chromatic-aberration`, `ripple`, `vhs-tape`, `grid-dissolve`.

**Rules**:
- `type` is required and must be in the enum.
- `preset` and `duration`/`ease` are **mutually exclusive** (W016 warning if both present; `duration`/`ease` takes priority).

---

## 9. Scenes (scenes)

```jsonc
"scenes": [
  {
    "id": "hook",                        // REQUIRED, globally unique
    "title": "Opening Hook",             // optional, storyboard-friendly name
    "start": 0,                          // REQUIRED, absolute seconds or reference string
    "duration": 4,                       // REQUIRED, seconds, minimum 0.01
    "trackIndex": 1,                     // optional, default 1 (track 0 reserved for root)
    "background": null,                  // optional, null = transparent (default)
    "zIndex": 1,                         // optional, default 1
    "transitionIn": { ... },            // optional, entrance transition
    "layoutAudit": {                     // optional, audit flags
      "allowOverflow": false,
      "bleed": false,
      "ignore": false,
      "allowCaptionZone": false
    },
    "elements": [ ... ]                  // REQUIRED, ≥ 1 element
  }
]
```

### Start reference syntax

```jsonc
// Absolute number
"start": 0

// Reference another scene's end time (start + duration)
"start": "hook"

// Reference with offset
"start": "hook + 0.5"
"start": "hook - 0.2"
```

When using a reference like `"hook"`, the engine resolves it to `hook.start + hook.duration`. Circular references are detected and rejected (E003).

### Track and overlap rules

- **Scenes on the same `trackIndex` must not overlap** in time (E002).
- **Scenes on different `trackIndex` values CAN overlap** — this is normal for transitions.
- When a transition is needed, place the new scene on a different track with a small temporal overlap.

### Typical multi-scene timeline

```jsonc
"scenes": [
  { "id": "hook",    "start": 0,    "duration": 4,   "trackIndex": 1 },
  { "id": "feature", "start": 3.8,  "duration": 4.5, "trackIndex": 2, "transitionIn": { "type": "zoom-through", "preset": "dramatic" } },
  { "id": "cta",     "start": 8.1,  "duration": 3.9, "trackIndex": 1, "transitionIn": { "type": "crossfade", "duration": 0.6, "ease": "sine.inOut" } }
]
```

- Scene 1 on track 1 → [0, 4)
- Scene 2 on track 2 → [3.8, 8.3) — 0.2s overlap with scene 1 for transition
- Scene 3 on track 1 → [8.1, 12) — 0.2s overlap with scene 2 for transition
- Total duration = 12 seconds

---

## 10. ID Naming Rules

All ids (`compositionId`, `scene.id`, `element.id`, `background.id`, `audioTrack.id`) must:
- Match pattern: `^[a-zA-Z_][a-zA-Z0-9_-]*$`
- Be **globally unique** across the entire config (E001)
- Be non-empty

**Recommended convention**: `<scene>-<role>`, e.g. `hook-title`, `feature-stat`, `cta-button`.

---

## 11. Architecture Modes (architecture)

### Monolithic (default)

```jsonc
"architecture": "monolithic"
```

Outputs a single `output/index.html` with all scenes on one GSAP timeline.

### Modular

```jsonc
"architecture": "modular",
"subCompositions": {
  "directory": "compositions",      // optional, default "compositions"
  "scenes": [                       // REQUIRED
    { "sceneId": "hook",  "variables": { "title": "Custom Title" } },
    { "sceneId": "feature" }
  ]
}
```

- Outputs a thin host `index.html` + one sub-composition HTML file per scene in `output/compositions/`.
- Each sub-composition is wrapped in a `<template>` tag.
- `subCompositions.scenes[].sceneId` must exist in the `scenes` array (E017).
- Per-instance `variables` override the global declarations.

---

## 12. Video Element Audio

Video elements get `muted` + `playsinline` attributes **automatically** (engine-fixed behavior — do not write them).

If the video has its own audio:
```jsonc
{
  "type": "video",
  "id": "demo-video",
  "src": "assets/demo.mp4",
  "hasAudio": true   // declares audio presence → removes auto-muted
}
```

**Rules** (E007):
- `hasAudio: true` requires a separate audio element or audioTrack for the same source (warning if missing).
- `hasAudio: false` (default) disallows `volume` animations on this element.

---

## 13. Style Object Rules (style)

```jsonc
"style": {
  "position": "absolute",
  "top": 380,           // number → auto-appends "px" (top is in LENGTH_PROPS)
  "left": 160,
  "opacity": 0.8,       // number → no "px" (opacity is NOT in LENGTH_PROPS)
  "zIndex": 10,          // number → no "px"
  "fontSize": 96,       // number → auto-appends "px"
  "color": "#e8eaed",   // string → used as-is
  "backgroundColor": "var(--background)"
}
```

**Properties that auto-append `px` when numeric** (LENGTH_PROPS):
`fontSize` · `maxWidth` · `width` · `height` · `top` · `left` · `right` · `bottom` · `gap` · `padding` · `margin` · `lineHeight` · `borderRadius` · `borderWidth`

**Forbidden in style** (E005):
- `transform` → use GSAP animations (x, y, scale, rotation) instead
- `visibility` → managed by HyperFrames
- `display` → managed by HyperFrames

camelCase keys are auto-converted to kebab-case: `fontSize` → `font-size`, `backgroundColor` → `background-color`.

---

## 14. Render Settings (renderSettings)

```jsonc
"renderSettings": {
  "output": "out.mp4",              // optional, default "out.mp4"
  "quality": "high",                 // optional: "draft" | "high", default "high"
  "fps": 30,                         // optional, 1-120
  "preview": false,                  // optional, default false
  "strict": false,                   // optional, default false
  "strictVariables": false,          // optional, default false
  "variablesFile": "vars.json",      // optional, path to external variable values
  "batch": "rows.json"               // optional, batch rendering file
}
```

---

## 15. Storyboard Metadata (storyboard) — optional

```jsonc
"storyboard": {
  "format": "1920x1080",
  "message": "Efficiency revolution — redefining how we work",
  "arc": "Hook → Feature → CTA",
  "audience": "Enterprise decision makers"
}
```

Used for automatic `STORYBOARD.md` generation; no validation impact.

---

## 16. Complete Example Skeleton

<details>
<summary>Click to expand full 3-scene example (adapted from examples/demo.json)</summary>

```jsonc
{
  "$schema": "../schemas/video-config.schema.json",
  "schemaVersion": "1.0",
  "compositionId": "product-launch",
  "width": 1920,
  "height": 1080,
  "duration": 12,
  "fps": 30,
  "title": "Q4 Product Launch",
  "language": "en",

  "palette": {
    "background": "#0b0f14",
    "foreground": "#e8eaed",
    "accent": "#66d9ef",
    "neutral": ["#1a2233", "#2a3040", "#3d4556", "#5a6380"]
  },

  "typography": {
    "headlineFont": "Montserrat",
    "headlineWeight": "900",
    "bodyFont": "EB Garamond",
    "bodyWeight": "400",
    "monoFont": "JetBrains Mono",
    "headlineSizeMin": 72,
    "bodySizeMin": 24,
    "letterSpacing": -0.02
  },

  "animationDefaults": {
    "duration": 0.6,
    "ease": "power3.out",
    "overwrite": "auto",
    "immediateRender": true
  },

  "variables": {
    "declarations": [
      { "id": "title", "type": "string", "label": "Main Title", "default": "Efficiency Revolution", "maxLength": 20 },
      { "id": "accent", "type": "color", "label": "Accent Color", "default": "#66d9ef" },
      { "id": "count", "type": "number", "label": "User Count", "default": 284000, "min": 0, "max": 9999999, "step": 1000 }
    ],
    "values": { "title": "Efficiency Revolution", "accent": "#66d9ef", "count": 284000 }
  },

  "background": {
    "id": "bg-gradient",
    "style": { "backgroundColor": "#0b0f14" },
    "animations": [
      { "to": { "backgroundColor": "#0a1530" }, "at": 4, "duration": 3, "ease": "sine.inOut" },
      { "to": { "backgroundColor": "#0b0f14" }, "at": 9, "duration": 3, "ease": "sine.inOut" }
    ]
  },

  "scenes": [
    {
      "id": "hook",
      "title": "Opening Hook",
      "start": 0,
      "duration": 4,
      "trackIndex": 1,
      "background": null,
      "elements": [
        {
          "id": "hook-title",
          "type": "text",
          "content": "{{title}}",
          "varBindings": { "varText": "title" },
          "style": {
            "position": "absolute", "top": 400, "left": 0, "right": 0,
            "color": "#e8eaed", "fontSize": 96, "fontWeight": "900",
            "textAlign": "center", "letterSpacing": "-0.02em", "maxWidth": 1400
          },
          "animations": [
            { "from": { "opacity": 0, "y": 80, "scale": 0.95 }, "duration": 1.0, "ease": "power4.out" },
            { "to": { "opacity": 0, "y": -60 }, "duration": 0.8, "ease": "power2.in", "delay": 2.8 }
          ]
        }
      ]
    },
    {
      "id": "feature",
      "title": "Core Feature",
      "start": 3.8,
      "duration": 4.5,
      "trackIndex": 2,
      "transitionIn": { "type": "zoom-through", "preset": "dramatic" },
      "elements": [
        {
          "id": "feature-stat",
          "type": "text",
          "content": "{{count}}",
          "varBindings": { "varText": "count" },
          "style": {
            "position": "absolute", "top": 300, "left": 0, "right": 0,
            "color": "#66d9ef", "fontSize": 120, "fontWeight": "900",
            "textAlign": "center", "fontVariantNumeric": "tabular-nums"
          },
          "animations": [
            { "from": { "opacity": 0, "y": 100, "scale": 0.8 }, "duration": 1.2, "ease": "elastic.out(1, 0.5)" }
          ]
        }
      ]
    },
    {
      "id": "cta",
      "title": "Call to Action",
      "start": 8.1,
      "duration": 3.9,
      "trackIndex": 1,
      "transitionIn": { "type": "crossfade", "duration": 0.6, "ease": "sine.inOut" },
      "elements": [
        {
          "id": "cta-headline",
          "type": "text",
          "content": "Try Now",
          "style": {
            "position": "absolute", "top": 400, "left": 0, "right": 0,
            "color": "#e8eaed", "fontSize": 80, "fontWeight": "900", "textAlign": "center"
          },
          "animations": [
            { "from": { "opacity": 0, "y": 60 }, "duration": 0.8, "ease": "power4.out" }
          ]
        },
        {
          "id": "cta-button",
          "type": "shape",
          "kind": "rect",
          "backgroundColor": "#66d9ef",
          "radius": 8,
          "style": { "position": "absolute", "top": 560, "left": 820, "width": 280, "height": 64 },
          "animations": [
            { "from": { "opacity": 0, "scale": 0.8 }, "duration": 0.6, "ease": "back.out(1.7)", "delay": 0.4 }
          ]
        }
      ]
    }
  ],

  "audioTracks": [
    {
      "id": "bgm",
      "src": "assets/bgm.mp3",
      "start": 0,
      "duration": 12,
      "trackIndex": 10,
      "volume": 0.6,
      "fades": [ { "at": 10.5, "to": 0, "duration": 1.5, "ease": "power2.in" } ]
    }
  ],

  "transitions": {
    "default": { "type": "crossfade", "preset": "smooth" }
  },

  "architecture": "monolithic",

  "renderSettings": {
    "output": "out.mp4",
    "quality": "high",
    "fps": 30,
    "preview": true,
    "strict": false
  },

  "storyboard": {
    "format": "1920x1080",
    "message": "Efficiency revolution — redefining how we work",
    "arc": "Hook → Feature → CTA",
    "audience": "Enterprise decision makers"
  }
}
```

</details>

---

## 17. Agent Writing Checklist

After writing a `video-config.json`, check each item:

### Required fields
- [ ] `compositionId` present and matches `^[a-zA-Z_][a-zA-Z0-9_-]*$`
- [ ] `width` and `height` present
- [ ] `scenes` array has ≥ 1 scene
- [ ] Each scene has `id`, `start`, `duration`, `elements`

### ID uniqueness
- [ ] All ids (composition / scene / element / background / audioTrack) are globally unique
- [ ] All ids match the pattern `^[a-zA-Z_][a-zA-Z0-9_-]*$`

### Timeline
- [ ] Scenes on the same `trackIndex` do not overlap
- [ ] `start` references resolve (no circular refs, referenced scenes have known duration)
- [ ] Total scene end time ≤ root `duration` (if specified)
- [ ] Background animation `at` and audio `fades.at` use absolute time

### Styles
- [ ] No `transform`, `visibility`, or `display` in any `style` object
- [ ] Length values are numbers (engine auto-appends `px`)

### Animations
- [ ] All animated properties are in the animatableProperty whitelist
- [ ] `repeat` ≥ 0 (no -1)
- [ ] `duration` ≥ 0.01

### Colors & fonts
- [ ] `palette` provides either `themeRef` or `background` + `foreground` + `accent`
- [ ] `typography.headlineFont` and `typography.bodyFont` are cross-family
- [ ] No disabled fonts (Inter, Roboto)

### Video
- [ ] Video elements do not specify `muted`/`playsinline` (engine adds them)
- [ ] `hasAudio: true` videos have a corresponding separate audio source

### Variables
- [ ] All `values` keys exist in `declarations`
- [ ] Value types match declaration types
- [ ] Enum values are within `options[].value`

### Architecture
- [ ] If `modular`, `subCompositions.scenes` is present and all `sceneId`s exist in `scenes`
