# j2hf Agent Skills

> This folder contains skill files for AI Agents (LLMs). Each file is a self-contained "skill card" with rule checklists, quick-reference tables, code templates, and common pitfalls.
>
> Skills are **self-contained**: an Agent only needs to read the relevant file to execute the task — no extra codebase exploration required.

---

## Skill Index

| File | Skill | Use When |
|------|-------|----------|
| [writing-video-config.md](./writing-video-config.md) | Write video-config JSON | Agent needs to create a complete `video-config.json` from scratch or from a brief |
| [writing-plugins.md](./writing-plugins.md) | Write j2hf plugins | Agent needs to create custom element types, inject timeline animations, or extend the generation pipeline |
| [element-types.md](./element-types.md) | Element types reference | Agent needs a quick lookup of the 7 built-in element types and their properties |
| [timeline-animations.md](./timeline-animations.md) | Timeline & animations | Agent needs to write element animations, scene transitions, background animations, or audio fades |
| [validation-rules.md](./validation-rules.md) | Validation rules reference | Agent needs to self-check a config or debug validation errors |
| [project-structure.md](./project-structure.md) | Project structure & flow | Agent needs to understand the codebase architecture, generation flow, or file responsibilities |

---

## Usage

### Prompt Template for Agents

```
Read skills/<skill-file>.md, then <specific task>.

Requirements:
1. Strictly follow the rule checklists in the skill file.
2. Reference the code templates when writing.
3. After completing, self-check against validation-rules.md.
```

### Common Workflows

#### Workflow 1: Write a video-config.json from scratch

```
1. Read skills/writing-video-config.md
2. Read skills/element-types.md (pick the right element types)
3. Read skills/timeline-animations.md (design animations & transitions)
4. Write video-config.json
5. Read skills/validation-rules.md and self-check
```

#### Workflow 2: Write a plugin

```
1. Read skills/writing-plugins.md (understand the three hooks)
2. Read skills/element-types.md (confirm built-in types don't cover the need)
3. Write the plugin .mjs file
4. Write the video-config.json that uses it (include "plugins" field)
5. Read skills/validation-rules.md and self-check
```

#### Workflow 3: Modify an existing config

```
1. Read skills/writing-video-config.md (understand the structure)
2. Read skills/validation-rules.md (ensure changes don't violate invariants)
3. Modify video-config.json
4. Self-check
```

---

## Project Overview

| Item | Value |
|------|-------|
| Name | `j2hf` (JSON2Hyperframes) |
| Version | ≥ 1.0.4 |
| Purpose | Convert a schema-constrained `video-config.json` → HyperFrames HTML + GSAP timeline + MP4 |
| Core philosophy | Keep the rendering kernel minimal — only deterministic JSON→HTML generation. Rich visual components are left to plugins. |
| Tech stack | Node ≥ 18 · ESM · TypeScript · GSAP 3 · AJV (draft-07) |
| CLI commands | `j2hf init` / `j2hf generate` / `j2hf preview` / `j2hf render` |

## File Navigation

```
skills/
├── README.md                  ← you are here
├── writing-video-config.md    ← complete guide to writing video-config JSON
├── writing-plugins.md         ← complete guide to writing plugins
├── element-types.md           ← quick reference for 7 built-in element types
├── timeline-animations.md     ← quick reference for animations & transitions
├── validation-rules.md        ← quick reference for 18 validation invariants
└── project-structure.md        ← codebase structure & generation flow

docs/                           ← human docs (more detailed prose)
├── schema.md / schema_en.md
├── plugin-development.md / plugin-development_en.md
└── validation.md / validation_en.md

schemas/
└── video-config.schema.json   ← AJV schema (machine-readable config contract)

examples/
├── demo.json                  ← full 3-scene example
├── plugin-demo.json           ← plugin usage example
└── plugins/j2hf-progress.mjs  ← reference plugin implementation
```
