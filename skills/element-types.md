# Skill: Element Types Reference

> Quick reference for the 7 built-in element types in j2hf.
>
> Use this to pick the right element type and get the exact property list without reading source code.

---

## Common Fields (all element types)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✅ YES | Globally unique. Pattern: `^[a-zA-Z_][a-zA-Z0-9_-]*$`. Used for animation targeting. |
| `type` | string | ✅ YES | Discriminator: `text` / `image` / `shape` / `group` / `video` / `audio` / `icon` |
| `style` | object | optional | Inline CSS in camelCase. Auto-converts to kebab-case. See [Style Rules](#style-rules). |
| `animations` | array | optional | GSAP tween array. See [timeline-animations.md](./timeline-animations.md). |
| `varBindings` | object | optional | Maps to variable declarations. Keys: `varText`, `varSrc`, `varHref`, `varAlt`. |
| `layoutAudit` | object | optional | Flags: `allowOverflow`, `bleed`, `ignore`, `allowCaptionZone` (all boolean). |
| `hidden` | boolean | optional | Default `false`. Outputs `data-hidden="true"`. |

### Style Rules

- **camelCase → kebab-case** auto-conversion: `fontSize` → `font-size`, `backgroundColor` → `background-color`.
- **Auto-append `px`** for numeric values of these properties (LENGTH_PROPS):
  `fontSize` · `maxWidth` · `width` · `height` · `top` · `left` · `right` · `bottom` · `gap` · `padding` · `margin` · `lineHeight` · `borderRadius` · `borderWidth`
- Numeric values for other properties (e.g. `opacity`, `zIndex`) are used as-is without `px`.
- **Forbidden properties** (E005): `transform`, `visibility`, `display`. Use GSAP animations (x, y, scale, rotation) instead of `transform`.

---

## 1. text

Renders a `<div>` with text content and full typography control.

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"text"` | ✅ | |
| `id` | string | ✅ | |
| `content` | string | ✅ | Text content. Use `{{varId}}` for variable interpolation convention. |
| `style` | object | optional | |
| `typography` | object | optional | Typography overrides (see below). |
| `textEffect` | string | optional | Named text animation preset: `typewriter`, `fade-in-words`, `slide-up-chars`, `reveal`. |
| `varBindings.varText` | string | optional | Binds content to a declared variable id. |
| `animations` | array | optional | |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

### typography sub-object

| Property | Type | Notes |
|----------|------|-------|
| `fontFamily` | string | Font family name (must be a preset or @font-face name). |
| `fontWeight` | string | `100`–`900` / `bold` / `normal` / `light`. Headlines ≥ 700, body ≤ 400. |
| `fontSize` | number \| string | Number → auto-appends `px`. |
| `lineHeight` | number \| string | Number → auto-appends `px`. |
| `letterSpacing` | number \| string | Number → treated as `em` (e.g. `-0.02` → `-0.02em`). |
| `textAlign` | string | `left` / `center` / `right` / `justify`. |
| `color` | string | CSS color. |
| `textTransform` | string | `none` / `uppercase` / `lowercase` / `capitalize`. |
| `fontVariantNumeric` | string | e.g. `tabular-nums`. |
| `maxWidth` | number \| string | Number → auto-appends `px`. For automatic line wrapping (no `<br>` needed). |

**Example**:
```jsonc
{
  "type": "text",
  "id": "hook-title",
  "content": "{{title}}",
  "varBindings": { "varText": "title" },
  "style": {
    "position": "absolute", "top": 400, "left": 0, "right": 0,
    "color": "#e8eaed", "fontSize": 96, "fontWeight": "900",
    "textAlign": "center", "letterSpacing": "-0.02em", "maxWidth": 1400
  },
  "animations": [
    { "from": { "opacity": 0, "y": 80 }, "duration": 1.0, "ease": "power4.out" }
  ]
}
```

---

## 2. image

Renders an `<img>` with object-fit, corner radius, and error fallback.

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"image"` | ✅ | |
| `id` | string | ✅ | |
| `src` | string | ✅ | Image URL or path. |
| `fit` | string | optional | `cover` (default) / `contain` / `fill`. Maps to `object-fit`. |
| `radius` | number | optional | Border radius in `px`. Default 0. |
| `fallbackSrc` | string | optional | Fallback when `varSrc` binding fails. Required if using `varBindings.varSrc`. |
| `style` | object | optional | |
| `varBindings.varSrc` | string | optional | Binds src to a declared variable id. |
| `animations` | array | optional | |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

**Example**:
```jsonc
{
  "type": "image",
  "id": "hero-img",
  "src": "assets/hero.jpg",
  "fit": "cover",
  "radius": 12,
  "style": { "position": "absolute", "top": 0, "left": 0, "width": 1920, "height": 1080 },
  "animations": [
    { "from": { "opacity": 0, "scale": 1.1 }, "duration": 1.5, "ease": "power2.out" }
  ]
}
```

---

## 3. shape

Renders a `<div>` as a basic decorative shape.

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"shape"` | ✅ | |
| `id` | string | ✅ | |
| `kind` | string | ✅ | `rect` / `circle` / `ellipse` / `line`. |
| `backgroundColor` | string | optional | CSS color. |
| `border` | object | optional | `{ width, color, style }`. `style`: `solid` / `dashed` / `dotted` / `none`. |
| `radius` | number | optional | Border radius in `px`. Only for `rect` / `ellipse` (ignored for `circle` which is always 50%). |
| `style` | object | optional | |
| `animations` | array | optional | |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

**Shape-specific behavior**:
- `kind: "circle"` or `"ellipse"` → `border-radius: 50%` is applied automatically.
- `kind: "rect"` with `radius` → `border-radius: {radius}px`.
- `border` object generates `border: {width}px {style} {color}`.

**Example**:
```jsonc
{
  "type": "shape",
  "id": "cta-button-bg",
  "kind": "rect",
  "backgroundColor": "#66d9ef",
  "radius": 8,
  "style": { "position": "absolute", "top": 560, "left": 820, "width": 280, "height": 64 },
  "animations": [
    { "from": { "opacity": 0, "scale": 0.8 }, "duration": 0.6, "ease": "back.out(1.7)", "delay": 0.4 }
  ]
}
```

---

## 4. group

Renders a `<div>` container with optional flex layout. Recursively renders `children`.

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"group"` | ✅ | |
| `id` | string | ✅ | |
| `layout` | string | optional | `absolute` (default) / `flex` / `grid`. |
| `direction` | string | optional | `row` / `column` / `row-reverse` / `column-reverse`. (flex-direction) |
| `gap` | number | optional | Flex gap in `px`. Default 0. |
| `align` | string | optional | CSS `align-items` value. |
| `justify` | string | optional | CSS `justify-content` value. |
| `padding` | number | optional | Padding in `px`. Default 0. |
| `style` | object | optional | |
| `children` | array | ✅ | Array of elements (any type, including nested groups). ≥ 1 item. |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

**Flex behavior**: When `layout: "flex"`, the engine sets:
- `display: flex`
- `flex-direction` from `direction`
- `gap` from `gap` (in `px`)
- `align-items` from `align`
- `justify-content` from `justify`
- `padding` from `padding` (in `px`)

These are merged into the `style` object; explicit `style` values take priority.

**Note**: The group itself does not participate in animation — animate its children or an internal wrapper.

**Example** (flex column, centered):
```jsonc
{
  "type": "group",
  "id": "center-group",
  "layout": "flex",
  "direction": "column",
  "align": "center",
  "justify": "center",
  "gap": 12,
  "style": { "position": "absolute", "top": "40%", "left": 0, "right": 0, "width": "100%", "height": "auto" },
  "children": [
    { "type": "text", "id": "title", "content": "Hello", "style": { "fontSize": 80, "textAlign": "center" } },
    { "type": "text", "id": "subtitle", "content": "World", "style": { "fontSize": 24, "textAlign": "center" } }
  ]
}
```

---

## 5. video

Renders a `<video>` element. **Automatically muted + playsinline** (unless `hasAudio: true`).

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"video"` | ✅ | |
| `id` | string | ✅ | |
| `src` | string | ✅ | Video URL or path. |
| `mediaStart` | number | optional | Start position within the video file. Default 0. |
| `volume` | number | optional | 0-1. Default 1. Only meaningful with `hasAudio: true`. |
| `hasAudio` | boolean | optional | Default `false`. If `true`, removes auto-muted and outputs `data-has-audio="true"`. |
| `crossOrigin` | string | optional | `anonymous` / `use-credentials`. |
| `style` | object | optional | |
| `varBindings` | object | optional | |
| `animations` | array | optional | Can include `volume` in `to`/`from` only if `hasAudio: true`. |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

**Rules**:
- `hasAudio: false` (default) → `muted` attribute added automatically. Do not write `muted` yourself.
- `hasAudio: true` → no `muted`; requires a separate audio element or audioTrack (E007 warning if missing).
- `volume` animation is only allowed when `hasAudio: true` (E007 error otherwise).

**Example**:
```jsonc
{
  "type": "video",
  "id": "bg-video",
  "src": "assets/background.mp4",
  "mediaStart": 2,
  "volume": 0.8,
  "hasAudio": true,
  "crossOrigin": "anonymous",
  "style": { "position": "absolute", "top": 0, "left": 0, "width": 1920, "height": 1080 },
  "animations": [
    { "from": { "opacity": 0 }, "duration": 1.0 }
  ]
}
```

---

## 6. audio

Renders an `<audio>` element for scene-local audio (distinct from root-level `audioTracks`).

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"audio"` | ✅ | |
| `id` | string | ✅ | |
| `src` | string | ✅ | Audio URL or path. |
| `volume` | number | optional | 0-1. Default 1. |
| `mediaStart` | number | optional | Start position within the audio file. Default 0. |
| `style` | object | optional | |
| `animations` | array | optional | |
| `hidden` | boolean | optional | |

**Note**: For background music with fades, prefer root-level `audioTracks` with `fades` array. Use inline `audio` elements for scene-specific sounds.

**Example**:
```jsonc
{
  "type": "audio",
  "id": "sfx-ding",
  "src": "assets/ding.mp3",
  "volume": 0.5,
  "mediaStart": 0
}
```

---

## 7. icon

Renders a `<div>` as an icon placeholder (background-color block sized by `size`).

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `type` | `"icon"` | ✅ | |
| `id` | string | ✅ | |
| `kind` | string | ✅ | Icon registry/catalog name. |
| `size` | number | optional | Width and height in `px`. Default 48. Minimum 8. |
| `color` | string | optional | CSS color (background-color). |
| `style` | object | optional | |
| `animations` | array | optional | |
| `layoutAudit` | object | optional | |
| `hidden` | boolean | optional | |

**Output**: `<div id="..." style="width: {size}px; height: {size}px; background-color: {color}; ...">`

**Example**:
```jsonc
{
  "type": "icon",
  "id": "checkmark",
  "kind": "check",
  "size": 64,
  "color": "var(--accent)",
  "style": { "position": "absolute", "top": 200, "left": 928 }
}
```

---

## Quick Decision Table

| I need to... | Use |
|--------------|-----|
| Show text | `text` |
| Show an image | `image` |
| Draw a rectangle, circle, or line | `shape` |
| Group elements with flexbox | `group` + `layout: "flex"` |
| Play a video clip | `video` |
| Play scene-local audio | `audio` (or root-level `audioTracks` for BGM) |
| Show an icon | `icon` |
| Show a chart, QR code, Lottie... | Write a [plugin](./writing-plugins.md) |

---

## Element Union (schema oneOf)

The schema's `elementUnion` is a `oneOf` of all 7 types, discriminated by the `type` field. Plugin-registered types bypass this union via the schema bypass mechanism (see [writing-plugins.md](./writing-plugins.md) §6).
