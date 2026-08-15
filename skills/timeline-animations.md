# Skill: Timeline, Animations & Transitions

> Complete reference for the GSAP timeline model in j2hf — element animations, background animations, scene transitions, and audio fades.

---

## 1. Timeline Architecture

j2hf uses a **single paused GSAP timeline** per composition. All element animations, background animations, and transition animations are collected into this one timeline.

```javascript
// generated output/index.html (simplified)
const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut", duration: 0.4 } });

// ── Element animations (collected from each scene's elements) ──
tl.from("#hook-title", { opacity: 0, y: 80, duration: 1.0, ease: "power4.out" }, 0);
tl.to("#cta-bg", { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }, 8.5);

// ── Background animations (absolute `at` time) ──
tl.from("#bg-layer-0", { scale: 1.2, duration: 4.0, ease: "power2.out" }, 0);

// ── Scene transitions (inserted at scene boundaries) ──
tl.to("#sn-bg", { opacity: 0, duration: 0.5, ease: "power2.inOut" }, 3.8);

// ── Audio fades ──
tl.fromTo("#aud-0", { volume: 0 }, { volume: 1.0, duration: 0.5, ease: "sine.inOut" }, 0);

// ── Plugin-injected tweens (inserted before this anchor) ──
// (plugin afterGenerate tweens go here)

window.__timelines["my-comp"] = tl;   // ← anchor line
```

### Key properties

| Property | Value |
|----------|-------|
| Timeline state | `paused: true` — the player controls playback |
| Default ease | `power2.inOut` (overridden by `config.animationDefaults.ease` or per-tween `ease`) |
| Default duration | `0.4` seconds (overridden by `config.animationDefaults.duration` or per-tween `duration`) |
| Anchor line | `window.__timelines["<compositionId>"] = tl;` — plugins inject tweens before this |

### Global animation defaults

Set at the config root to apply to all tweens that don't specify their own:

```jsonc
{
  "animationDefaults": {
    "duration": 0.6,
    "ease": "power3.out",
    "stagger": 0.05,
    "overwrite": false
  }
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `duration` | number | `0.4` | Per-tween `duration` overrides this. Minimum `0.01`. |
| `ease` | string | `power2.inOut` | Per-tween `ease` overrides this. See [Easing Catalog](#easing-catalog). |
| `stagger` | number | (none) | Default stagger for tweens targeting multiple elements. |
| `overwrite` | boolean | `false` | GSAP overwrite mode. |

---

## 2. Element Animations

Each element can have an `animations` array. The engine recursively collects these via `collectAnimLines(elements, sceneStart, lines)`.

### Animation object structure

```jsonc
{
  "animations": [
    {
      "to":   { "opacity": 1, "x": 0, "duration": 0.8, "ease": "power2.out" },
      "from": { "opacity": 0, "y": 50 },
      "delay": 0.2
    }
  ]
}
```

Three modes are supported via the presence of `to` / `from` fields:

| Mode | Required field | Generated GSAP | Description |
|------|----------------|----------------|-------------|
| `to` | `to` | `tl.to("#id", {...props}, start)` | Animate to these values |
| `from` | `from` | `tl.from("#id", {...props}, start)` | Animate from these values |
| `fromTo` | both `from` and `to` | `tl.fromTo("#id", {...from}, {...to}, start)` | Animate from → to |

**Order of checks** in the engine: `from` + `to` → `fromTo`; `to` only → `to`; `from` only → `from`.

### Time calculation

Each tween's start time = `sceneStart + delay`:

```
start = scene.start + animation.delay
```

- `scene.start` is the scene's absolute start time (or resolved start reference — see [Scene Start References](#scene-start-references)).
- `animation.delay` (default `0`) is added to `sceneStart`. Minimum `0`.
- All times are in **seconds** (not frames).

### Animation properties

#### Core properties

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `duration` | number | from `animationDefaults` or `0.4` | Seconds. Minimum `0.01`. |
| `ease` | string | from `animationDefaults` or `power2.inOut` | GSAP easing name. |
| `delay` | number | `0` | Seconds added to sceneStart. Minimum `0`. |
| `repeat` | number | `0` | Number of repeats. **Minimum `0`** — `-1` (infinite) is blocked by schema. |
| `yoyo` | boolean | `false` | If `true` + `repeat > 0`, alternates forward/backward. |
| `stagger` | number \| object | none | Stagger child elements. Number or `{ each, from, grid, axis }`. |
| `transformOrigin` | string | none | CSS transform-origin (e.g. `"center bottom"`). |
| `overwrite` | boolean | from defaults | GSAP overwrite mode. |
| `immediateRender` | boolean | none | GSAP immediateRender. |
| `label` | string | none | Adds a timeline label at this tween's start position. |

#### Animatable properties (in `to` / `from`)

These are the properties you can animate — defined by `animatableProperty` in the schema:

| Category | Properties |
|----------|------------|
| **Transform** | `opacity`, `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotation`, `skewX`, `skewY`, `transformOrigin` |
| **Color** | `color`, `backgroundColor`, `borderColor` |
| **Dimension** | `width`, `height`, `borderRadius` |
| **Spacing** | `padding`, `margin` |
| **CSS Variable** | `--css-var` (any string starting with `--`) |
| **Audio** | `volume` (only on elements with `hasAudio: true` — E007) |
| **Text** | `innerText` |

> **E005 critical rule**: Do **NOT** put `transform`, `visibility`, or `display` in `style` — use these animatable properties instead. GSAP manages `transform` internally when you animate `x`/`y`/`scale`/`rotation`.

### Easing catalog

The engine passes ease strings directly to GSAP. Common eases:

| Category | Examples |
|----------|----------|
| **Power** | `power1.inOut`, `power2.out`, `power3.in`, `power4.inOut` |
| **Back** | `back.out(1.7)`, `back.inOut(2)` — slight overshoot |
| **Elastic** | `elastic.out(1, 0.3)`, `elastic.inOut` |
| **Bounce** | `bounce.out`, `bounce.inOut` |
| **Sine** | `sine.inOut`, `sine.out` — gentle |
| **Expo** | `expo.out`, `expo.inOut` — dramatic |
| **Circ** | `circ.inOut` |
| **Steps** | `steps(8)` |
| **Custom** | `"M0,0 C0,0 0.5,1 1,1"` — cubic bezier path |

**Defaults by context**:
- Title/hook reveals: `power4.out` (strong deceleration)
- CTAs and buttons: `back.out(1.7)` (slight overshoot)
- Transitions: `power2.inOut` (smooth, consistent)
- Gentle/background: `sine.inOut`

### Stagger

Stagger applies when a tween targets multiple elements (via `stagger` field or when the engine expands to children):

**Number form** (simple interval):
```jsonc
{ "from": { "opacity": 0, "y": 30, "stagger": 0.1 } }
```

**Object form** (advanced):
```jsonc
{
  "stagger": {
    "each": 0.1,          // interval between each
    "from": "center",     // "start" | "center" | "end" | "random" | "edges" | number
    "grid": "auto",       // "auto" | [rows, cols] | null
    "axis": "x"           // "x" | "y" | null
  }
}
```

---

## 3. Background Animations

Each scene can have a `background` object with its own `animations` array. These animations use **absolute `at` time** (not relative to sceneStart).

### Background structure

```jsonc
{
  "background": {
    "type": "gradient",
    "gradient": { "from": "#0f172a", "to": "#334155", "angle": 135 },
    "animations": [
      { "at": 0, "to": { "opacity": 1 }, "duration": 1.0, "ease": "power2.out" },
      { "at": 2, "to": { "scale": 1.1, "duration": 4, "ease": "sine.inOut" } }
    ]
  }
}
```

### Background animation properties

| Property | Type | Notes |
|----------|------|-------|
| `at` | number | **Absolute start time** (seconds from composition start, NOT from sceneStart). |
| `to` / `from` | object | Same animatable properties as element animations. |
| `duration` | number | Seconds. |
| `ease` | string | GSAP easing. |

The engine's `buildBackgroundAnims` function collects these and generates:
```javascript
tl.to("#bg-layer-0", { opacity: 1, duration: 1.0, ease: "power2.out" }, 0);
tl.to("#bg-layer-0", { scale: 1.1, duration: 4, ease: "sine.inOut" }, 2);
```

> **Key difference**: Background animations use `at` (absolute time). Element animations use `delay` (relative to sceneStart).

---

## 4. Scene Transitions

Transitions smooth the visual handoff between scenes. They are defined at the scene level in the `transition` field.

### Transition object

```jsonc
{
  "transition": {
    "type": "crossfade",
    "duration": 0.4,
    "ease": "power2.inOut"
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string | ✅ | One of the 6 implemented types (see below). |
| `duration` | number | optional | Transition duration in seconds. Default `0.4`. |
| `ease` | string | optional | GSAP ease. Default `power2.inOut`. |

> The transition's timing is automatically calculated based on the overlap between the outgoing and incoming scenes on their tracks. If scenes don't overlap (e.g. sequential on the same track), transitions still work but may be less visually impactful.

### 6 Implemented Transition Types

#### crossfade
Outgoing scene fades out while incoming scene fades in simultaneously.

```jsonc
{ "type": "crossfade", "duration": 0.4, "ease": "power2.inOut" }
```

**Generated**:
```javascript
tl.to("#outgoing-bg", { opacity: 0, duration: 0.4, ease: "power2.inOut" }, transitionStart);
tl.from("#incoming-bg", { opacity: 0, duration: 0.4, ease: "power2.inOut" }, transitionStart);
```

#### blur-crossfade
Like crossfade but with a blur滤镜 during the transition.

```jsonc
{ "type": "blur-crossfade", "duration": 0.5, "ease": "power2.inOut" }
```

**Effect**: Both scenes blur out → crossfade → blur in. Uses `filter: blur()`.

#### zoom-through
Outgoing scene zooms in (scale up) while fading out; incoming scene starts zoomed in and settles to normal scale.

```jsonc
{ "type": "zoom-through", "duration": 0.5, "ease": "power3.inOut" }
```

**Generated** (simplified):
```javascript
tl.to("#outgoing-bg", { scale: 1.3, opacity: 0, duration: 0.5, ease: "power3.inOut" }, transitionStart);
tl.from("#incoming-bg", { scale: 1.3, opacity: 0, duration: 0.5, ease: "power3.inOut" }, transitionStart);
```

#### zoom-out
Outgoing scene zooms out (scale down) while fading out; incoming scene scales up from small.

```jsonc
{ "type": "zoom-out", "duration": 0.5, "ease": "power2.inOut" }
```

#### push-slide
Incoming scene slides in from the right, pushing the outgoing scene out to the left.

```jsonc
{ "type": "push-slide", "duration": 0.5, "ease": "power2.inOut" }
```

**Effect**: `x` position animation on both scenes' background layers.

#### color-dip-black
The composition briefly dips to black (or a specified color) between scenes.

```jsonc
{ "type": "color-dip-black", "duration": 0.3, "ease": "power2.inOut" }
```

**Effect**: A full-screen black overlay fades in then out at the transition point.

### 21 Unimplemented Types (schema-defined)

The schema enumerates 27 total transition types, but only 6 are implemented in the engine. The remaining 21 are defined for forward compatibility and **will not produce any transition animation** — they will log a warning and be skipped:

`glitch` · `ripple` · `staggered-blocks` · `clock-wipe` · `spiral` · `shutter` · `pixelate` · `wave` · `vortex` · `prism` · `trails` · `echo` · `kaleidoscope` · `ascii` · `film-burn` · `lightning` · `kaleidoscope-zoom` · `invert-flash` · `channel-shift` · `datamosh` · `chromatic-wipe`

> **Plugin opportunity**: Implement these as `afterGenerate` timeline injection. See [writing-plugins.md](./writing-plugins.md) §8.

### Transition presets

The schema defines named transition presets that bundle `type` + `duration` + `ease`:

| Preset | type | duration | ease |
|--------|------|----------|------|
| `snappy` | crossfade | 0.2 | power4.inOut |
| `smooth` | crossfade | 0.4 | power2.inOut |
| `gentle` | crossfade | 0.6 | sine.inOut |
| `dramatic` | zoom-through | 0.8 | power3.inOut |
| `instant` | crossfade | 0.1 | power4.out |
| `luxe` | blur-crossfade | 0.5 | power2.inOut |

Use a preset by setting `"transition": "smooth"` (string form) instead of an object.

---

## 5. Audio Fades

Root-level `audioTracks` can have `fades` for smooth volume transitions.

### audioTrack structure

```jsonc
{
  "audioTracks": [
    {
      "id": "bgm",
      "src": "assets/bgm.mp3",
      "volume": 0.7,
      "fades": [
        { "at": 0, "type": "in", "duration": 0.5 },
        { "at": 11.5, "type": "out", "duration": 0.5 }
      ]
    }
  ]
}
```

### Fade object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `at` | number | ✅ | Absolute start time (seconds from composition start). |
| `type` | string | ✅ | `"in"` (fade in from 0) or `"out"` (fade out to 0). |
| `duration` | number | ✅ | Fade duration in seconds. |

The engine's `buildAudioFades` generates:
```javascript
// fade in
tl.fromTo("#aud-bgm", { volume: 0 }, { volume: 0.7, duration: 0.5, ease: "sine.inOut" }, 0);
// fade out
tl.to("#aud-bgm", { volume: 0, duration: 0.5, ease: "sine.inOut" }, 11.5);
```

> Fades use the audio track's `volume` as the target for fade-in. Fade-out always targets `0`.

---

## 6. Scene Start References

Scenes use `start` either as an absolute number (seconds) or as a reference to another scene.

### Absolute start

```jsonc
{ "id": "hook", "start": 0, "duration": 4, "track": 1 }
```

### Reference start

```jsonc
{ "id": "feature", "start": "hook.start + 3.8", "duration": 4.5, "track": 2 }
```

Supported reference forms:
- `"hook.start"` → resolves to scene `hook`'s start time
- `"hook.start + 3.8"` → hook's start + 3.8 seconds
- `"hook.start + hook.duration"` → hook's start + hook's duration (= hook's end)
- `"hook.end"` → hook's start + hook's duration

The engine resolves these at generation time, building a dependency graph. **Circular references are an error** (E003).

### Tracks

Tracks let scenes overlap:

```jsonc
{
  "scenes": [
    { "id": "hook",   "start": 0,                       "duration": 4,   "track": 1 },
    { "id": "feature","start": "hook.start + 3.8",      "duration": 4.5, "track": 2 },
    { "id": "cta",    "start": "feature.start + 4.3",   "duration": 3.9, "track": 1 }
  ]
}
```

- Scenes on the **same track** must not overlap (E002).
- Scenes on **different tracks** can overlap — the overlap region is where transitions play.
- `track` is optional (default `1`).

---

## 7. Timeline Composition Example

A complete 3-scene composition with overlapping tracks, transitions, background, and audio:

```jsonc
{
  "compositionId": "product-launch",
  "width": 1920, "height": 1080, "fps": 30,
  "duration": 12,
  "animationDefaults": { "duration": 0.6, "ease": "power3.out" },

  "audioTracks": [
    { "id": "bgm", "src": "assets/bgm.mp3", "volume": 0.7,
      "fades": [
        { "at": 0, "type": "in", "duration": 0.5 },
        { "at": 11.5, "type": "out", "duration": 0.5 }
      ]
    }
  ],

  "scenes": [
    {
      "id": "hook", "start": 0, "duration": 4, "track": 1,
      "background": {
        "type": "gradient",
        "gradient": { "from": "#0f172a", "to": "#334155", "angle": 135 },
        "animations": [
          { "at": 0, "to": { "opacity": 1 }, "duration": 0.8, "ease": "power2.out" },
          { "at": 2, "to": { "scale": 1.1 }, "duration": 4, "ease": "sine.inOut" }
        ]
      },
      "elements": [
        {
          "type": "text", "id": "hook-title", "content": "Meet the Future",
          "style": { "position": "absolute", "top": 450, "left": 0, "right": 0, "fontSize": 96, "textAlign": "center", "color": "#e2e8f0", "fontWeight": "900" },
          "animations": [
            { "from": { "opacity": 0, "y": 80 }, "duration": 1.0, "ease": "power4.out" },
            { "to": { "opacity": 0, "y": -40 }, "duration": 0.4, "ease": "power2.in", "delay": 3.5 }
          ]
        }
      ]
    },
    {
      "id": "feature", "start": "hook.start + 3.8", "duration": 4.5, "track": 2,
      "transition": { "type": "zoom-through", "duration": 0.5, "ease": "power3.inOut" },
      "elements": [
        {
          "type": "text", "id": "feature-title", "content": "AI-powered",
          "style": { "position": "absolute", "top": 400, "left": 960, "fontSize": 72, "fontWeight": "800" },
          "animations": [
            { "from": { "opacity": 0, "scale": 0.8 }, "duration": 0.8, "ease": "back.out(1.7)", "delay": 0.3 }
          ]
        }
      ]
    },
    {
      "id": "cta", "start": "feature.start + 4.3", "duration": 3.9, "track": 1,
      "transition": { "type": "crossfade", "duration": 0.4 },
      "elements": [
        {
          "type": "shape", "id": "cta-bg", "kind": "rect",
          "backgroundColor": "var(--accent)", "radius": 12,
          "style": { "position": "absolute", "top": 520, "left": 760, "width": 400, "height": 72 },
          "animations": [
            { "from": { "opacity": 0, "scale": 0.8 }, "duration": 0.6, "ease": "back.out(1.7)", "delay": 0.3 }
          ]
        },
        {
          "type": "text", "id": "cta-text", "content": "Get Started",
          "style": { "position": "absolute", "top": 538, "left": 760, "width": 400, "fontSize": 32, "textAlign": "center", "color": "#fff" },
          "animations": [
            { "from": { "opacity": 0 }, "duration": 0.4, "delay": 0.5 }
          ]
        }
      ]
    }
  ]
}
```

---

## 8. Agent Animation Checklist

- [ ] All times in seconds (not frames)
- [ ] Animation `duration` ≥ 0.01
- [ ] Animation `delay` ≥ 0 (relative to sceneStart)
- [ ] `repeat` ≥ 0 (no `-1` infinite loops)
- [ ] No `transform`, `visibility`, `display` in `style` — use `x`/`y`/`scale`/`rotation`/`opacity` in animations
- [ ] `ease` strings are valid GSAP eases (power1-4, back, elastic, sine, expo, etc.)
- [ ] Background animations use `at` (absolute time), element animations use `delay` (relative)
- [ ] Transition `type` is one of the 6 implemented types (crossfade, blur-crossfade, zoom-through, zoom-out, push-slide, color-dip-black)
- [ ] Audio `fades` use `at` (absolute time) + `type` + `duration`
- [ ] Scene start references don't create circular dependencies (E003)
- [ ] Scenes on the same track don't overlap (E002)
- [ ] `volume` animation only on elements with `hasAudio: true` (E007)
- [ ] `animationDefaults` set at config root for consistent timing across the composition
