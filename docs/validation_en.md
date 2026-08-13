# JSON2Hyperframes Validation Invariant Checklist

[English](validation_en.md) | [简体中文](validation.md)

> This checklist defines the cross-field validation rules that `scripts/validate.mjs` needs to implement.
> Each invariant includes: validation method, pseudo-code/algorithm description, and error message format.

---

## Invariant 1: Global Uniqueness of IDs

**Validation Method**: O(n) deduplication check

```
Algorithm:
  1. Collect all scene IDs (scenes[].id)
  2. Collect all element IDs (scenes[].elements[].id, recursively traversing group.children)
  3. Collect root-level IDs (background.id, audioTracks[].id)
  4. Check if there are duplicates in the collected set
  5. Under modular architecture: internal element IDs must be prefixed with sceneId (check for prefix match)
```

**Error Message**:
```
[E001] Duplicate ID found: "hero-title" appears in scenes "hook" and "feature"
```

---

## Invariant 2: Clips on the Same Track Must Not Overlap in Time

**Validation Method**: Interval sorting check

```
Algorithm:
  1. Group scenes by trackIndex
  2. Resolve all start references to absolute seconds (see Invariant 3)
  3. Sort scenes in ascending order by start within each group
  4. For each adjacent pair (prev, next):
     - If prev.start + prev.duration > next.start → Overlap detected
  5. Note: Clips on different trackIndices are allowed to overlap (normal multi-track behavior)
```

**Error Message**:
```
[E002] Track overlap on track 1: scene "s1" [0, 4) overlaps with scene "s2" [2, 6)
```

---

## Invariant 3: Start References Must Be Resolvable, Acyclic, and Referenced Clips Must Have Known Durations

**Validation Method**: Graph traversal

```
Algorithm:
  1. Build a map of scene ID → Scene object
  2. For each scene's start:
     a. Number → Use directly
     b. String → Parse reference pattern:
        - "<id>" → Find referenced scene, get its start + duration
        - "<id> + N" → Same as above, add offset
        - "<id> - N" → Same as above, subtract offset
     c. Referenced scene must exist in the map (otherwise undefined reference)
     d. Referenced scene must already have a resolved start (resolve order)
  3. Cycle detection: DFS tracking a visited set
     - If A references B, and B references A → Cycle detected
     - If A references B, B references C, and C references A → Cycle detected
  4. Referenced scene must have duration > 0 (otherwise position is undefined)
```

**Error Message**:
```
[E003] Unresolved reference: scene "s3" references "s4" which is not defined
[E003] Circular reference detected: s1 → s2 → s1
[E003] Referenced scene "s2" has zero duration, cannot compute start for "s3"
```

---

## Invariant 4: Sum of Scene Durations ≤ Root Duration

**Validation Method**: Numerical sum

```
Algorithm:
  1. Calculate max_end = max(scene.start + scene.duration) for all scenes
  2. If root.duration exists:
     - If max_end > root.duration → Exceeded
     - Allow max_end < root.duration (leaves empty space at the end / last scene exit animation)
  3. If root.duration does not exist, automatically set it to max_end (generator behavior)
```

**Error Message**:
```
[E004] Scene total exceeds root duration: scenes end at 9.5s, but root duration is 8s
```

---

## Invariant 5: Animation Properties ∈ Whitelist

**Validation Method**: Schema + whitelist validation

```
Whitelist (Animatable properties):
  opacity, x, y, scale, scaleX, scaleY, rotation,
  skewX, skewY, transformOrigin,
  color, backgroundColor, borderColor, borderRadius,
  width, height,
  padding, margin,
  --css-var, volume, innerText

Algorithm:
  1. Traverse the animations array of all elements
  2. For each tween:
     a. Check if all property keys in from and to are in the whitelist
     b. If not → Error
     c. Check if repeat is -1 → Error (Schema has minimum: 0, but validator code does a double-check)
     d. Check if repeat is a negative number (other than -1) → Error
  3. Traverse the style of all elements:
     a. Check if there is a transform key → Error
     b. Schema already restricts this, but validator double-checks to prevent schema bypass
```

**Error Message**:
```
[E005] Forbidden animation property "width" in scene "s1", element "hero-title"
[E005] repeat: -1 is forbidden in scene "s3", element "badge" (use repeat: 0 for no repeat)
[E005] Style must not contain "transform" (scene "s2", element "logo"). Use GSAP x/y/scale/rotation instead.
```

---

## Invariant 6: Media src File Paths Exist

**Validation Method**: Filesystem check

```
Algorithm:
  1. Collect all media src paths:
     - src of elements of type image/video/audio
     - src of audioTracks
  2. For each path, check if the file exists (fs.existsSync)
  3. Paths are resolved relative to the project root directory
  4. If the path starts with http:// or https://, skip it (remote resource)
  5. Warnings only, non-fatal (allows dynamic loading at render time)
```

**Error Message**:
```
[E006] Media file not found: "assets/bgm.mp3" (scene "bgm", element "audio-track")
[W006] Media file not found: "assets/hero.jpg" — will fail at render time
```

---

## Invariant 7: Video Automatically Muted+Playsinline; Same-Source Audio Must Be Separate

**Validation Method**: Structural check

```
Algorithm:
  1. For each video element:
     a. The generator automatically adds muted + playsinline attributes (invariant, not a validation check)
     b. No need for the user to write them explicitly
  2. For each video element with hasAudio: true:
     a. Check if there is a separate audio element (or audioTrack) corresponding to the same src
     b. If not → Warning (audio may be lost)
  3. If video has volume animation but hasAudio: false → Error (no audio to control)
```

**Error Message**:
```
[E007] Scene "s2" video "demo" has hasAudio: true but no separate audio element for "assets/demo.mp4"
[E007] Scene "s1" video "bg-clip" has volume animation but hasAudio: false
```

---

## Invariant 8: Transition Type ∈ Catalog Enum; Ease ∈ Named List

**Validation Method**: Enum validation

```
Transition Type Enum (see docs/schema_en.md Transition Catalog Quick Reference):
  push-slide, vertical-push, elastic-push, squeeze,
  zoom-through, zoom-out, gravity-drop,
  circle-iris, diamond-iris, diagonal-split, clock-wipe, shutter,
  crossfade, blur-crossfade, focus-pull, color-dip-black,
  staggered-blocks, horizontal-blinds, vertical-blends,
  light-leak, overexposure-burn, film-burn,
  glitch, chromatic-aberration, ripple, vhs-tape,
  grid-dissolve

Ease Names List (see docs/schema_en.md Ease Names Table):
  power[1-4].(out|in|inOut), back.out, elastic.out, bounce.out,
  steps(N), sine.inOut, circ.inOut, expo.out, expo.inOut, none,
  M0,0 C... (CSS bezier)

Algorithm:
  1. Collect all transition configurations:
     a. transitions.default
     b. all values in transitions.byScene
     c. each scene's scene.transitionIn
  2. Check if type is in the enum
  3. If ease is provided and is not a CSS bezier curve:
     a. Check if ease is in the named list
     b. CSS Bezier (M0,0...) is allowed as custom (match basic format)
  4. If preset is provided, check if it is in the preset enum
  5. If both duration/ease and preset are provided → Warning (priority is clear: duration/ease overrides preset)
```

**Error Message**:
```
[E008] Unknown transition type: "warp-speed" in scene "feature"
[E008] Unknown ease name: "nonexistent-ease" in scene "s1" transition
```

---

## Invariant 9: Contrast Ratio Between Text and Background ≈ WCAG AA

**Validation Method**: Contrast ratio algorithm

```
Algorithm:
  1. For each text element, get its color and the background of the scene it resides in
     (if scene background is null, use palette.background)
  2. Calculate relative luminance:
     L = 0.2126 * R + 0.7152 * G + 0.0722 * B
     where R, G, B are converted from sRGB to linear space
  3. Calculate contrast ratio:
     contrast = (L1 + 0.05) / (L2 + 0.05)  // L1 is the lighter color
  4. If contrast < 3.0 → Warning (WCAG AA requires 4.5:1 for normal text, 3:1 for large text)
  5. Note: Approximation only. Exact WCAG calculation requires parsing color strings
```

**Error Message**:
```
[W009] Low contrast ratio: text color "#666666" on background "#0b0f14" = 2.3:1 (WCAG AA requires ≥ 3:1 for large text)
```

---

## Invariant 10: Visual Clip Must Have class="clip"

**Validation Method**: Fixed in generator (not a validator check)

```
Description:
  When outputting HTML, the generator automatically adds class="clip" to each <section> element.
  This is not checked by the validator, but is a fixed output contract of the generator.
```

---

## Invariant 11: Root Has data-start="0"

**Validation Method**: Fixed in generator (not a validator check)

```
Description:
  When outputting HTML, the generator automatically adds data-start="0" to the composition root <div>.
  This is not checked by the validator, but is a fixed output contract of the generator.
```

---

## Invariant 12: Single Paused Timeline Registered Under `window.__timelines[compositionId]`

**Validation Method**: Fixed in generator (not a validator check)

```
Description:
  The generator output ensures:
  1. A single gsap.timeline({ paused: true })
  2. All animations are attached to this timeline
  3. It is registered under window.__timelines["<compositionId>"]
  4. compositionId matches the one in JSON
  This is not checked by the validator, but is a fixed output contract of the generator.
```

---

## Invariant 13: Values Keys Must Exist in Declarations

**Validation Method**: Set comparison

```
Algorithm:
  1. Collect all declarations[].id → Set
  2. Collect all keys in values → Set
  3. Check if all values keys are a subset of declarations
  4. If there are keys in values that are not in declarations → Error
```

**Error Message**:
```
[E013] Undeclared variable value: "unknownKey" is not in declarations (declared: title, accent, count, showCta)
```

---

## Invariant 14: Value Types Must Match Declaration

**Validation Method**: Type checking

```
Algorithm:
  1. For each values key, find the corresponding declaration
  2. Check the type of the value based on declaration.type:
     - string → Must be a string
     - color → Must be a string matching #hex/rgb()/hsl() format
     - number → Must be a number
     - boolean → Must be a boolean
     - enum → Value must be in the options[].value list
     - image/file → Must be a string
  3. If type does not match → Error
  4. If type is number and has min/max constraints → Check range
```

**Error Message**:
```
[E014] Variable "count" expects number, got string "one hundred thousand"
[E014] Variable "tone" has value "c" but enum options are: a, b
```

---

## Invariant 15: Enum Values Must Exist in Options

**Validation Method**: Set check

```
Algorithm:
  1. For each declaration of type=enum, collect options[].value → Set
  2. If there is a corresponding value in values → Check if it is in the Set
  3. If not → Error
  4. Check if default is also in options (Schema already validates this, but double-checked here)
```

**Error Message**:
```
[E015] Variable "tone" has value "c" but valid options are: ["a", "b"]
```

---

## Invariant 16: Transition Specifies Both duration/ease and preset

**Validation Method**: Schema dependency condition (double-checked in validator code)

```
Algorithm:
  1. For each transition configuration, check if both duration/ease and preset exist
  2. If both exist → Warning (Schema forbids this, but validator code checks)
  3. Priority: duration/ease overrides preset
```

**Error Message**:
```
[W016] Transition in scene "s2" has both preset and duration/ease — preset will be ignored
```

---

## Invariant 17: subCompositions Required Under Modular Architecture

**Validation Method**: Conditional requirement

```
Algorithm:
  1. If architecture === "modular"
  2. Check if subCompositions exists
  3. If not → Error
  4. Check if sceneId in subCompositions.scenes exists in scenes
  5. If not → Error
```

**Error Message**:
```
[E017] architecture is "modular" but subCompositions is missing
[E017] subComposition references scene "unknown" which is not defined in scenes array
```

---

## Invariant 18: Headline and Body Fonts Paired Across Families

**Validation Method**: Documentation suggestion (non-blocking warning)

```
Algorithm:
  1. Check typography.headlineFont and typography.bodyFont
  2. Determine if they span different families based on preset classifications (sans/serif/mono/CJK)
  3. If they are within the same family → Warning (non-blocking)
  4. If either is in the disabled list → Error
```

**Font Family Classification**:
- Sans: Montserrat, Oswald, League Gothic, Archivo Black, Inter (disabled), Roboto (disabled)
- Serif: EB Garamond, Playfair Display, Bodoni Moda, Cinzel, Prata, Syne
- Mono: Space Mono, IBM Plex Mono, JetBrains Mono, Source Code Pro
- CJK: Noto Sans JP, Noto Sans SC

**Error Message**:
```
[W018] Body font "Montserrat" is in the same family (sans) as headline font "Oswald" — consider a serif body font for contrast
[E018] Font "Inter" is in the disabled list — consider Montserrat or League Gothic
```

---

## Validator Implementation Notes

### Priority

Invariant validation should be executed in three layers:

1. **Schema Layer** (ajv / JSON Schema): Covers simple types, formats, and required checks.
2. **Code Validator** (scripts/validate.mjs): Covers cross-field, stateful, and filesystem checks.
3. **Generator Fixed** (fixed rules guaranteed by the generator, not validated).

### Validator Output Format

```json
{
  "valid": false,
  "errors": [
    { "code": "E001", "message": "Duplicate ID: ...", "path": "scenes[0].id" },
    { "code": "E002", "message": "Track overlap: ...", "path": "scenes[1]" }
  ],
  "warnings": [
    { "code": "W009", "message": "Low contrast: ...", "path": "scenes[0].elements[0]" }
  ],
  "info": [
    { "code": "I010", "message": "class=\"clip\" is generated automatically" }
  ]
}
```

### Error Severity

| Level | Code Prefix | Meaning |
|---|---|---|
| Fatal | E | Must be fixed, generator cannot proceed |
| Warning | W | Recommendation to fix, does not block generation |
| Info | I | Informational note, no action required |

### Skipping Rules

The validator supports a `--skip` parameter to skip specific invariants:
```bash
npx validate --config demo.json --skip E009,E018
```

### Pseudo-code Entry Point

```javascript
function validate(config) {
  const errors = [];
  const warnings = [];
  const info = [];

  // 1. Schema Validation (ajv)
  const schemaValid = validateSchema(config);
  if (!schemaValid) { errors.push(...schemaErrors); }

  // 2. Resolve Scene Start References
  const scenes = resolveSceneStarts(config.scenes);

  // 3. Run Invariants
  invariant1(config, errors);  // Unique IDs
  invariant2(scenes, errors);  // Track Overlap
  invariant3(config, errors);  // Start References
  invariant4(config, scenes, errors);  // Duration
  invariant5(config, errors);  // Animatable Properties
  invariant6(config, warnings);  // Media Files Existence
  invariant7(config, warnings);  // Video Audio Independence
  invariant8(config, errors);  // Transition Types
  invariant9(config, warnings);  // Contrast Ratio
  // I10-I12: Fixed in Generator
  invariant13(config, errors);  // Values Keys
  invariant14(config, errors);  // Values Types
  invariant15(config, errors);  // Enum Values
  invariant16(config, warnings);  // Transition Conflicts
  invariant17(config, errors);  // Modular Integrity
  invariant18(config, warnings);  // Font Pairing

  return { valid: errors.length === 0, errors, warnings, info };
}
```
