# Skill: Validation Rules

> The 18 validation invariants j2hf enforces. Use this to catch errors before running `j2hf generate` and to understand validation error messages.
>
> Severity: **E** = Error (generation stops) · **W** = Warning (logged but continues) · **I** = Info (auto-fixed by generator)

---

## E001 — Unique Element IDs

**Severity**: Error
**Message**: `Element ID "<id>" is not unique`

Every element `id` across the entire composition must be unique. No duplicates, even across different scenes.

```jsonc
// ❌ Error
{ "elements": [
  { "type": "text", "id": "title", "content": "A" },
  { "type": "text", "id": "title", "content": "B" }
]}

// ✅ Fix
{ "elements": [
  { "type": "text", "id": "hook-title", "content": "A" },
  { "type": "text", "id": "feature-title", "content": "B" }
]}
```

**ID pattern**: `^[a-zA-Z_][a-zA-Z0-9_-]*$` — start with letter or underscore, then letters/digits/underscores/hyphens.

---

## E002 — No Track Overlap

**Severity**: Error
**Message**: `Scene "<id>" overlaps with scene "<id>" on track <n>`

Scenes on the **same track** must not overlap in time. Scenes on **different tracks** can overlap (this is how transitions work).

```jsonc
// ❌ Error — both on track 1, 6-10s overlaps 6-8s
{ "scenes": [
  { "id": "a", "start": 0,  "duration": 10, "track": 1 },
  { "id": "b", "start": 6,  "duration": 4,  "track": 1 }
]}

// ✅ Fix — move b to track 2
{ "scenes": [
  { "id": "a", "start": 0,  "duration": 10, "track": 1 },
  { "id": "b", "start": 6,  "duration": 4,  "track": 2 }
]}
```

---

## E003 — No Circular Start References

**Severity**: Error
**Message**: `Circular start reference detected involving scene "<id>"`

Scene `start` can reference another scene: `"hook.start + 3.8"`. Circular chains are forbidden.

```jsonc
// ❌ Error — a→b→a
{ "scenes": [
  { "id": "a", "start": "b.start + 1", "duration": 3 },
  { "id": "b", "start": "a.start + 1", "duration": 3 }
]}

// ✅ Fix — use absolute start for at least one
{ "scenes": [
  { "id": "a", "start": 0,              "duration": 3 },
  { "id": "b", "start": "a.start + 1", "duration": 3 }
]}
```

**Supported reference forms**: `"sceneId.start"`, `"sceneId.end"` (= start + duration), `"sceneId.start + N"`.

---

## E004 — Scene Duration Does Not Exceed Composition

**Severity**: Error
**Message**: `Scene "<id>" extends beyond composition duration`

`scene.start + scene.duration` must not exceed the composition's total `duration`.

```jsonc
// ❌ Error if composition duration is 10
{ "id": "late-scene", "start": 8, "duration": 5 }  // ends at 13 > 10

// ✅ Fix — reduce duration or start earlier
{ "id": "late-scene", "start": 8, "duration": 2 }  // ends at 10
```

---

## E005 — Animatable Property Whitelist + Style Restrictions

**Severity**: Error
**Messages**:
- `Invalid animation property "<prop>"`
- `Style property "transform" is forbidden — use animation properties (x, y, scale, rotation) instead`
- `Style property "display" is forbidden`
- `Style property "visibility" is forbidden`

### Animation properties whitelist

Only these properties can appear in `to`/`from` objects:

```
opacity, x, y, scale, scaleX, scaleY, rotation, skewX, skewY, transformOrigin,
color, backgroundColor, borderColor, borderRadius, width, height, padding, margin,
--css-var (any string starting with --), volume, innerText
```

```jsonc
// ❌ Error — "filter" is not in the whitelist
{ "animations": [{ "to": { "filter": "blur(10px)" } }] }

// ✅ Plugin afterGenerate can inject filter tweens directly into the timeline
```

### Style forbidden properties

The schema's `camelCaseStyle` definition uses `patternProperties` with a negative lookahead:

```json
"patternProperties": {
  "^(?!transform$|visibility$|display$).*$": {}
}
```

This means `transform`, `visibility`, and `display` **cannot appear in any `style` object**. Use GSAP animations instead:

```jsonc
// ❌ Error
{ "style": { "transform": "translateX(100px)" } }

// ✅ Fix — animate x instead
{ "style": { "position": "absolute", "left": 0 }, "animations": [{ "to": { "x": 100 } }] }
```

---

## E006 — Media Source Exists

**Severity**: Error
**Message**: `Media source "<path>" does not exist`

For `image`, `video`, `audio` elements and `audioTracks`, the `src` is checked for existence (if it's a local path, not a URL starting with `http`).

```jsonc
// ❌ Error if file doesn't exist
{ "type": "image", "id": "img", "src": "assets/missing.png" }

// ✅ Fix — ensure the file exists, or use a URL
{ "type": "image", "id": "img", "src": "https://example.com/image.png" }
```

---

## E007 — Video Audio Independence

**Severity**: Error
**Message**: `Video "<id>" has hasAudio:true but no companion audio element`

### Rules

1. `video` with `hasAudio: false` (default) → auto-muted, no issue.
2. `video` with `hasAudio: true` → must have either:
   - An `audio` element in the same scene, or
   - A root-level `audioTracks` entry.
3. `volume` animation on a `video` element requires `hasAudio: true`.

```jsonc
// ❌ Error — hasAudio:true but no audio
{ "type": "video", "id": "clip", "src": "a.mp4", "hasAudio": true }
// + no audioTracks and no audio element

// ✅ Fix — add an audioTrack
{ "audioTracks": [{ "id": "vid-audio", "src": "a.mp4", "volume": 1 }] }
```

---

## W009 — WCAG Color Contrast

**Severity**: Warning
**Message**: `Color contrast ratio <ratio> may be insufficient (WCAG)`

Checks text `color` against `backgroundColor` (or palette background) for WCAG AA compliance (4.5:1 for normal text, 3:1 for large text).

```jsonc
// ⚠ Warning — low contrast
{ "style": { "color": "#999", "backgroundColor": "#fff" } }

// ✅ Fix — increase contrast
{ "style": { "color": "#333", "backgroundColor": "#fff" } }
```

This is a warning, not an error — generation continues. But for production quality, address it.

---

## I010–I012 — Generator Auto-Fixed

**Severity**: Info (auto-fixed, no action required)

| Code | What's auto-fixed |
|------|-------------------|
| **I010** | Missing `fps` → defaults to `30` |
| **I011** | Scene missing `track` → defaults to `1` |
| **I012** | Missing `animationDefaults` → defaults to `{ duration: 0.4, ease: "power2.inOut" }` |

These are logged as info messages. No config change needed.

---

## E013 — Variable Declaration Required

**Severity**: Error
**Message**: `Variable "<id>" is referenced but not declared`

If an element uses `varBindings.varText: "title"`, then `variables.declarations` must contain `{ "id": "title", "type": "string", "default": "..." }`.

```jsonc
// ❌ Error — variable not declared
{
  "variables": { "declarations": [] },
  "scenes": [{
    "elements": [{ "type": "text", "id": "t", "content": "{{title}}", "varBindings": { "varText": "title" } }]
  }]
}

// ✅ Fix — declare the variable
{
  "variables": { "declarations": [
    { "id": "title", "type": "string", "default": "Hello World" }
  ]},
  "scenes": [{
    "elements": [{ "type": "text", "id": "t", "content": "{{title}}", "varBindings": { "varText": "title" } }]
  }]
}
```

---

## E014 — Variable Value Type Mismatch

**Severity**: Error
**Message**: `Variable "<id>" value type mismatch: expected <type>, got <type>`

The `default` value type must match the declared `type`.

```jsonc
// ❌ Error — type is "number" but default is a string
{ "id": "count", "type": "number", "default": "five" }

// ✅ Fix
{ "id": "count", "type": "number", "default": 5 }
```

---

## E015 — Variable Enum Violation

**Severity**: Error
**Message**: `Variable "<id>" value "<value>" is not in enum [...]`

If the declaration has an `enum` array, the `default` must be one of the enum values.

```jsonc
// ❌ Error
{ "id": "theme", "type": "string", "enum": ["light", "dark"], "default": "blue" }

// ✅ Fix
{ "id": "theme", "type": "string", "enum": ["light", "dark"], "default": "dark" }
```

---

## W016 — Transition Preset Conflict

**Severity**: Warning
**Message**: `Transition preset "<name>" conflicts with explicit transition properties`

If a scene specifies both a transition preset name and explicit `type`/`duration`/`ease` properties, the explicit values win and the preset is discarded.

```jsonc
// ⚠ Warning — type/duration override the "smooth" preset
{ "transition": { "preset": "smooth", "type": "zoom-through", "duration": 0.3 } }

// ✅ Fix — use one or the other
{ "transition": "smooth" }
// or
{ "transition": { "type": "zoom-through", "duration": 0.3 } }
```

---

## E017 — Modular Architecture Completeness

**Severity**: Error
**Message**: `Modular architecture requires subCompositions.scenes to list all scene ids`

When `architecture: "modular"`, the `subCompositions.scenes` array must contain every scene id referenced in `scenes`.

```jsonc
// ❌ Error — "cta" missing from subCompositions
{
  "architecture": "modular",
  "subCompositions": { "scenes": ["hook", "feature"] },
  "scenes": [
    { "id": "hook", ... },
    { "id": "feature", ... },
    { "id": "cta", ... }
  ]
}

// ✅ Fix
{ "subCompositions": { "scenes": ["hook", "feature", "cta"] } }
```

---

## W018 — Font Pairing Quality

**Severity**: Warning
**Message**: `Font pairing "<headline>" + "<body>" may not be optimal`

Checks if the headline/body font pair is in the recommended list. Not an error — just a quality suggestion.

### Recommended pairings

| Headline (≥700) | Body (≤400) | Style |
|-----------------|-------------|-------|
| Montserrat 900 | EB Garamond 400 | Modern + Classic |
| Oswald 700 | Playfair Display 400 | Condensed + Elegant |
| Archivo Black 900 | Noto Sans SC 400 | Bold + CJK |
| League Gothic | EB Garamond 400 | Tall + Classic |
| Cinzel | EB Garamond 400 | Engraved + Classic |
| Syne | Space Mono 400 | Geometric + Mono |

```jsonc
// ✅ Good
{ "typography": { "headlineFont": "Montserrat", "bodyFont": "EB Garamond" } }

// ⚠ Warning — not a recommended pair
{ "typography": { "headlineFont": "Inter", "bodyFont": "Oswald" } }
```

> **Note**: `Inter` is listed as a disabled font in the schema. Use `Montserrat` instead.

---

## Validation Flow

```
j2hf generate
  │
  ├─ loadConfig → JSON.parse
  ├─ loadPlugins → register custom element types
  ├─ validateConfig
  │   ├─ AJV schema validation (draft-07)
  │   │   └─ collectPluginElementPaths → bypass AJV errors on plugin-registered elements
  │   ├─ Invariant checks (E001-E018)
  │   │   ├─ E001: unique IDs
  │   │   ├─ E002: no track overlap
  │   │   ├─ E003: no circular start refs
  │   │   ├─ E004: duration within composition
  │   │   ├─ E005: anim whitelist + style restrictions
  │   │   ├─ E006: media src exists
  │   │   ├─ E007: video audio independence
  │   │   ├─ W009: WCAG contrast
  │   │   ├─ E013-E015: variable declarations
  │   │   ├─ W016: transition preset conflict
  │   │   ├─ E017: modular completeness
  │   │   └─ W018: font pairing
  │   └─ └─ I010-I012: auto-fix defaults
  ├─ generate → render HTML + timeline
  └─ return files
```

**Error stops**: Any `E` severity error stops generation. `W` warnings are logged but continue. `I` info is auto-fixed silently.

---

## Plugin Schema Bypass

AJV validation is strict (`additionalProperties: false` at root and per-element). But plugin-registered element types are **not** in the schema's `oneOf` union.

The engine calls `collectPluginElementPaths(config)` before validation:
1. Walks all scene elements recursively.
2. For any element where `globalRegistry.getRenderer(el.type)` returns a hit, records that element's JSON path.
3. After AJV runs, errors under those paths are **discarded**.

**Implication**: Plugin elements can have any field structure — AJV won't block them. But the plugin must self-validate custom fields in `beforeGenerate()`. See [writing-plugins.md](./writing-plugins.md) §6.

---

## Agent Validation Checklist

- [ ] All element `id` values are unique (E001)
- [ ] Scene `id` values match `^[a-zA-Z_][a-zA-Z0-9_-]*$` pattern (E001)
- [ ] No track overlap for scenes on the same `track` (E002)
- [ ] No circular `start` references (E003)
- [ ] All scenes end within composition `duration` (E004)
- [ ] No `transform`, `visibility`, `display` in any `style` object (E005)
- [ ] Animation `to`/`from` only use whitelisted properties (E005)
- [ ] All `src` paths exist or are URLs (E006)
- [ ] `video` with `hasAudio: true` has companion audio (E007)
- [ ] `volume` animation only on `hasAudio: true` elements (E007)
- [ ] All `varBindings` reference declared variables (E013)
- [ ] Variable `default` type matches `type` field (E014)
- [ ] Variable `default` is in `enum` if `enum` is defined (E015)
- [ ] If `architecture: "modular"`, `subCompositions.scenes` lists all scene ids (E017)
- [ ] No `repeat: -1` (schema enforces `minimum: 0`)
- [ ] All `duration` values ≥ 0.01 (schema enforces)
- [ ] All `delay` values ≥ 0 (schema enforces)
