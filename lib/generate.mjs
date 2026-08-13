/**
 * JSON2Hyperframes — Core generator
 *
 * Reads a video-config.json and produces HyperFrames-compatible HTML.
 * Supports two architectures:
 *   monolithic — a single index.html holding every scene and one timeline
 *   modular    — a thin host index.html plus one file per sub-composition
 */

import j2h from 'node-json2html';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const json2html = j2h.default || j2h;
// node-json2html v3 uses .render() not .transform()
if (!json2html.transform) json2html.transform = json2html.render;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ─── Helpers ─────────────────────────────────────────────────────────
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
// Numeric style values that represent lengths need a px unit.
const LENGTH_PROPS = new Set(['fontSize', 'maxWidth', 'width', 'height', 'top', 'left', 'right', 'bottom', 'gap', 'padding', 'margin', 'lineHeight', 'borderRadius', 'borderWidth']);
const styleStr = (obj) => obj ? Object.entries(obj).map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' && LENGTH_PROPS.has(k) ? v + 'px' : v}`).join('; ') : '';
const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Single quotes inside a single-quoted attribute break the attribute.
const attrJSON = (json) => json.replace(/'/g, '\\u0027');

// ─── Schema validation ───────────────────────────────────────────────
export function validateConfig(config) {
  const schemaPath = path.join(PKG_ROOT, 'schemas', 'video-config.schema.json');
  if (!fs.existsSync(schemaPath)) return [];

  let Ajv;
  try {
    Ajv = require('ajv');
  } catch {
    return []; // ajv unavailable — skip schema validation rather than fail
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new (Ajv.default || Ajv)({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (validate(config)) return [];
  return validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
}

// ─── CSS variables from palette ──────────────────────────────────────
function buildCSSVars(config) {
  const p = config.palette;
  if (!p) return '';
  const lines = [];
  if (p.background) lines.push(`--background: ${p.background}`);
  if (p.foreground) lines.push(`--foreground: ${p.foreground}`);
  if (p.accent) lines.push(`--accent: ${p.accent}`);
  if (p.neutral) p.neutral.forEach((c, i) => lines.push(`--neutral-${i}: ${c}`));
  if (p.themeRef) lines.push(`/* themeRef: ${p.themeRef} */`);
  return lines.join(';\n');
}

// ─── Variable declarations ───────────────────────────────────────────
function varsJSONFor(config, overrides) {
  const decls = config.variables && config.variables.declarations;
  if (!decls) return null;
  if (!overrides) return JSON.stringify(decls);
  const merged = decls.map(d =>
    Object.prototype.hasOwnProperty.call(overrides, d.id)
      ? { ...d, default: overrides[d.id] }
      : d
  );
  return JSON.stringify(merged);
}

// ─── Root styles ─────────────────────────────────────────────────────
function buildStyles(config, { scoped } = {}) {
  const cssVars = buildCSSVars(config);
  const typo = config.typography || {};
  const W = config.width || 1920;
  const H = config.height || 1080;
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
#root {
  ${cssVars};
  width: ${W}px; height: ${H}px;
  overflow: hidden; position: relative;
  ${scoped ? '' : `background-color: var(--background, #0b0f14);\n  `}color: var(--foreground, #e8eaed);
  font-family: '${typo.bodyFont || 'Inter'}', sans-serif;
}
#root h1, #root h2, #root h3 { font-family: '${typo.headlineFont || 'Inter'}', sans-serif; }
.clip { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }`;
}

// ─── HTML head ───────────────────────────────────────────────────────
function buildHead(config, varsJSON) {
  const CID = config.compositionId || 'main';
  const W = config.width || 1920;
  const H = config.height || 1080;
  const FPS = config.fps || 30;
  const DURATION = config.duration;
  const varsAttr = varsJSON ? ` data-composition-variables='${attrJSON(varsJSON)}'` : '';
  return `<!DOCTYPE html>
<html lang="${config.language || 'zh-CN'}"${varsAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(config.title || 'JSON2Hyperframes')}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<style>
${buildStyles(config)}
</style>
</head>
<body>
<div id="root" data-composition-id="${CID}" data-start="0" data-width="${W}" data-height="${H}" data-fps="${FPS}"${DURATION ? ` data-duration="${DURATION}"` : ''}>`;
}

// ─── Background layer ────────────────────────────────────────────────
function buildBackground(config) {
  const bg = config.background;
  if (!bg) return '';
  return `\n<div id="${bg.id}" style="${styleStr(bg.style)}"></div>`;
}

// ─── Elements ────────────────────────────────────────────────────────
function renderElement(el, config) {
  const elId = el.id;
  const s = styleStr(el.style);
  const baseAttrs = `id="${elId}"` + (s ? ` style="${s}"` : '');
  const varBinds = el.varBindings
    ? Object.entries(el.varBindings).map(([k, v]) => `data-${kebab(k)}="${esc(v)}"`).join(' ')
    : '';
  const hidden = el.hidden ? ' data-hidden="true"' : '';
  const audit = el.layoutAudit
    ? Object.entries(el.layoutAudit).map(([k, v]) => `data-layout-${kebab(k)}="${v}"`).join(' ')
    : '';

  switch (el.type) {
    case 'text': {
      const typo = el.typography || {};
      const px = (v) => typeof v === 'number' ? v + 'px' : v;
      const fontSize = typo.fontSize ? `font-size: ${px(typo.fontSize)};` : '';
      const color = typo.color ? `color: ${typo.color};` : '';
      const textAlign = typo.textAlign ? `text-align: ${typo.textAlign};` : '';
      const letterSpacing = typo.letterSpacing !== undefined ? `letter-spacing: ${typeof typo.letterSpacing === 'number' ? typo.letterSpacing + 'em' : typo.letterSpacing};` : '';
      const fontFamily = typo.fontFamily ? `font-family: '${typo.fontFamily}';` : '';
      const fontWeight = typo.fontWeight ? `font-weight: ${typo.fontWeight};` : '';
      const textTransform = typo.textTransform ? `text-transform: ${typo.textTransform};` : '';
      const lineHeight = typo.lineHeight ? `line-height: ${px(typo.lineHeight)};` : '';
      const maxWidth = typo.maxWidth ? `max-width: ${px(typo.maxWidth)};` : '';
      const fontVariant = typo.fontVariantNumeric ? `font-variant-numeric: ${typo.fontVariantNumeric};` : '';
      const extraStyle = [fontSize, color, textAlign, letterSpacing, fontFamily, fontWeight, textTransform, lineHeight, maxWidth, fontVariant].filter(Boolean).join(' ');
      const fullStyle = [s, extraStyle].filter(Boolean).join('; ');
      // data-var-text fallback: use the variable's declared default when bound
      let textContent = el.content ?? '';
      if (el.varBindings?.varText) {
        const decl = config.variables?.declarations?.find(d => d.id === el.varBindings.varText);
        textContent = decl?.default !== undefined ? String(decl.default) : textContent;
      }
      return json2html.transform([el], {
        "<>": "div",
        "id": () => elId,
        "style": () => fullStyle,
        "text": () => textContent,
        ...(varBinds ? { "data-var-text": (e) => e.varBindings?.varText || '' } : {}),
        ...(hidden ? { "data-hidden": "true" } : {})
      }).trim();
    }

    case 'image': {
      const fit = el.fit || 'cover';
      const radius = el.radius ? `border-radius: ${el.radius}px;` : '';
      const imgStyle = `object-fit: ${fit}; ${radius} ${s}`.trim();
      return json2html.transform([el], {
        "<>": "img",
        "id": () => elId,
        "src": (e) => e.src,
        "style": () => imgStyle,
        ...(el.fallbackSrc ? { "onerror": `this.src='${el.fallbackSrc}'` } : {}),
        ...(varBinds ? { "data-var-src": (e) => e.varBindings?.varSrc || '' } : {}),
        ...(hidden ? { "data-hidden": "true" } : {})
      }).trim();
    }

    case 'shape': {
      const shapeStyle = el.style ? { ...el.style } : {};
      if (el.backgroundColor) shapeStyle.backgroundColor = el.backgroundColor;
      if (el.radius !== undefined && el.kind !== 'circle' && el.kind !== 'ellipse')
        shapeStyle.borderRadius = `${el.radius}px`;
      if (el.kind === 'circle' || el.kind === 'ellipse')
        shapeStyle.borderRadius = '50%';
      if (el.border)
        shapeStyle.border = `${el.border.width}px ${el.border.style || 'solid'} ${el.border.color || '#fff'}`;
      return json2html.transform([el], {
        "<>": "div",
        "id": () => elId,
        "style": () => styleStr(shapeStyle),
        ...(hidden ? { "data-hidden": "true" } : {})
      }).trim();
    }

    case 'group': {
      const gStyle = el.style ? { ...el.style } : {};
      if (el.layout === 'flex') {
        gStyle.display = 'flex';
        if (el.direction) gStyle.flexDirection = el.direction;
        if (el.gap !== undefined) gStyle.gap = `${el.gap}px`;
        if (el.align) gStyle.alignItems = el.align;
        if (el.justify) gStyle.justifyContent = el.justify;
        if (el.padding !== undefined) gStyle.padding = `${el.padding}px`;
      }
      const children = el.children ? el.children.map(c => renderElement(c, config)).join('\n') : '';
      return `<div id="${elId}"${audit ? ' ' + audit : ''}${hidden} style="${styleStr(gStyle)}">\n${children}\n</div>`;
    }

    case 'video': {
      const muted = el.hasAudio ? '' : ' muted';
      return `<video ${baseAttrs} src="${esc(el.src)}" data-media-start="${el.mediaStart || 0}" data-volume="${el.volume ?? 1}"${muted} playsinline${el.crossOrigin ? ` crossorigin="${el.crossOrigin}"` : ''}${el.hasAudio ? ' data-has-audio="true"' : ''}${audit ? ' ' + audit : ''}${hidden}${varBinds ? ' ' + varBinds : ''}></video>`;
    }

    case 'audio': {
      return `<audio ${baseAttrs} src="${esc(el.src)}" data-media-start="${el.mediaStart || 0}" data-volume="${el.volume ?? 1}"${audit ? ' ' + audit : ''}${hidden}></audio>`;
    }

    case 'icon': {
      const iconStyle = `width: ${el.size || 48}px; height: ${el.size || 48}px; background-color: ${el.color || 'currentColor'}; ${s}`.trim();
      return `<div ${baseAttrs} style="${iconStyle}"${audit ? ' ' + audit : ''}${hidden}></div>`;
    }

    default:
      return `<!-- Unknown element type: ${el.type} -->`;
  }
}

// ─── Scene clip ──────────────────────────────────────────────────────
function renderScene(scene, config, { localStart = false } = {}) {
  const elements = scene.elements.map(el => renderElement(el, config)).join('\n');
  const bg = scene.background === null ? '' : (scene.background ? ` style="${styleStr(scene.background)}"` : '');
  const audit = scene.layoutAudit
    ? Object.entries(scene.layoutAudit).map(([k, v]) => ` data-layout-${kebab(k)}="${v}"`).join('')
    : '';
  const start = localStart ? 0 : scene.start;
  return `\n<section class="clip" id="clip-${scene.id}" data-start="${start}" data-duration="${scene.duration}" data-track-index="${scene.trackIndex ?? 1}"${bg}${audit} style="z-index: ${scene.zIndex ?? 1}">\n${elements}\n</section>`;
}

// ─── Audio tracks ────────────────────────────────────────────────────
function buildAudioTracks(config) {
  const tracks = config.audioTracks;
  if (!tracks || tracks.length === 0) return '';
  return tracks.map(t => {
    const fades = t.fades && t.fades.length > 0
      ? ` data-fades='${attrJSON(JSON.stringify(t.fades))}'`
      : '';
    return `\n<audio id="audio-${t.id}" src="${esc(t.src)}" data-start="${t.start ?? 0}"${t.duration ? ` data-duration="${t.duration}"` : ''} data-track-index="${t.trackIndex ?? 10}" data-volume="${t.volume ?? 1}"${fades}></audio>`;
  }).join('');
}

// ─── Timeline ────────────────────────────────────────────────────────
function timelineDefaults(config) {
  const defaults = config.animationDefaults || {};
  return JSON.stringify({
    duration: defaults.duration ?? 0.6,
    ease: defaults.ease ?? 'power3.out',
    overwrite: defaults.overwrite ?? 'auto',
    immediateRender: defaults.immediateRender ?? true
  });
}

function collectAnimLines(elements, sceneStart, lines) {
  for (const el of elements) {
    if (el.animations) {
      for (const anim of el.animations) {
        const target = `#${el.id}`;
        const overrides = {};
        if (anim.duration) overrides.duration = anim.duration;
        if (anim.ease) overrides.ease = anim.ease;
        if (anim.delay !== undefined) overrides.delay = anim.delay;
        if (anim.repeat !== undefined) overrides.repeat = anim.repeat;
        if (anim.yoyo !== undefined) overrides.yoyo = anim.yoyo;
        if (anim.stagger !== undefined) overrides.stagger = anim.stagger;
        if (anim.immediateRender !== undefined) overrides.immediateRender = anim.immediateRender;
        if (anim.transformOrigin) overrides.transformOrigin = anim.transformOrigin;

        const start = Math.round((sceneStart + (overrides.delay || 0)) * 100) / 100;
        delete overrides.delay;

        if (anim.from && anim.to) {
          lines.push(`tl.fromTo("${target}", ${JSON.stringify(anim.from)}, ${JSON.stringify({ ...anim.to, ...overrides })}, ${start});`);
        } else if (anim.from) {
          lines.push(`tl.from("${target}", ${JSON.stringify({ ...anim.from, ...overrides })}, ${start});`);
        } else if (anim.to) {
          lines.push(`tl.to("${target}", ${JSON.stringify({ ...anim.to, ...overrides })}, ${start});`);
        }
      }
    }
    if (el.children) collectAnimLines(el.children, sceneStart, lines);
  }
}

function buildBackgroundAnims(config, lines) {
  const bg = config.background;
  if (!bg || !bg.animations) return;
  for (const anim of bg.animations) {
    const overrides = {};
    if (anim.duration) overrides.duration = anim.duration;
    if (anim.ease) overrides.ease = anim.ease;
    lines.push(`tl.to("#${bg.id}", ${JSON.stringify({ ...anim.to, ...overrides })}, ${anim.at});`);
  }
}

function buildTransitionAnims(scenes, lines) {
  for (let i = 1; i < scenes.length; i++) {
    const scene = scenes[i];
    const prev = scenes[i - 1];
    const transIn = scene.transitionIn;
    if (!transIn) continue;
    const type = transIn.type || 'crossfade';
    const dur = transIn.duration ?? 0.4;
    const ease = transIn.ease || 'power2.inOut';
    const overlap = Math.min(dur, scene.duration || dur);
    const transStart = scene.start;

    if (type === 'crossfade' || type === 'blur-crossfade') {
      lines.push(`tl.to("#clip-${prev.id}", { opacity: 0, duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
    } else if (type === 'zoom-through' || type === 'zoom-out') {
      lines.push(`tl.to("#clip-${prev.id}", { scale: 0.95, opacity: 0, duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
    } else if (type === 'push-slide') {
      lines.push(`tl.to("#clip-${prev.id}", { x: "-100%", duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
      lines.push(`tl.from("#clip-${scene.id}", { x: "100%", duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
    } else if (type === 'color-dip-black') {
      lines.push(`tl.to("#clip-${prev.id}", { backgroundColor: "#000", opacity: 0, duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
    } else {
      lines.push(`tl.to("#clip-${prev.id}", { opacity: 0, duration: ${overlap}, ease: "${ease}" }, ${transStart});`);
    }
  }
}

function buildAudioFades(config, lines) {
  for (const t of config.audioTracks || []) {
    if (!t.fades) continue;
    for (const fade of t.fades) {
      lines.push(`tl.to("#audio-${t.id}", { volume: ${fade.to}, duration: ${fade.duration || 1}, ease: "${fade.ease || 'power2.in'}" }, ${fade.at});`);
    }
  }
}

function buildTimeline(config) {
  const CID = config.compositionId || 'main';
  const lines = [`const tl = gsap.timeline({ paused: true, defaults: ${timelineDefaults(config)} });`];
  buildBackgroundAnims(config, lines);
  for (const scene of config.scenes || []) collectAnimLines(scene.elements, scene.start, lines);
  buildTransitionAnims(config.scenes || [], lines);
  buildAudioFades(config, lines);
  lines.push(`window.__timelines["${CID}"] = tl;`);
  return lines.join('\n');
}

// ─── Monolithic document ─────────────────────────────────────────────
function buildMonolithic(config) {
  const varsJSON = varsJSONFor(config);
  return [
    buildHead(config, varsJSON),
    buildBackground(config),
    ...config.scenes.map(s => renderScene(s, config)),
    buildAudioTracks(config),
    '\n</div>',
    varsJSON ? `\n<script>document.querySelector('[data-composition-id]').setAttribute('data-composition-variables','${attrJSON(varsJSON)}')</script>` : '',
    '\n<script>',
    'window.__timelines = window.__timelines || {};',
    buildTimeline(config),
    '</script>',
    '\n</body>\n</html>'
  ].join('\n');
}

// ─── Modular: host document ──────────────────────────────────────────
function buildModularHost(config, instances, directory) {
  const varsJSON = varsJSONFor(config);
  const sceneById = new Map(config.scenes.map(s => [s.id, s]));

  const hosts = instances.map(inst => {
    const scene = sceneById.get(inst.sceneId);
    const src = `${directory}/${inst.sceneId}.html`;
    return `\n<div id="${inst.sceneId}-host" class="clip" data-composition-id="${inst.sceneId}" data-composition-src="${src}" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="${scene.trackIndex ?? 1}" style="z-index: ${scene.zIndex ?? 1}"></div>`;
  }).join('');

  // Scenes without a sub-composition instance stay inline in the host.
  const inlineScenes = config.scenes
    .filter(s => !instances.some(i => i.sceneId === s.id))
    .map(s => renderScene(s, config))
    .join('');

  const lines = [`const tl = gsap.timeline({ paused: true, defaults: ${timelineDefaults(config)} });`];
  buildBackgroundAnims(config, lines);
  for (const scene of config.scenes) {
    if (instances.some(i => i.sceneId === scene.id)) continue;
    collectAnimLines(scene.elements, scene.start, lines);
  }
  buildAudioFades(config, lines);
  lines.push(`window.__timelines["${config.compositionId || 'main'}"] = tl;`);

  return [
    buildHead(config, varsJSON),
    buildBackground(config),
    hosts,
    inlineScenes,
    buildAudioTracks(config),
    '\n</div>',
    varsJSON ? `\n<script>document.querySelector('[data-composition-id]').setAttribute('data-composition-variables','${attrJSON(varsJSON)}')</script>` : '',
    '\n<script>',
    'window.__timelines = window.__timelines || {};',
    lines.join('\n'),
    '</script>',
    '\n</body>\n</html>'
  ].join('\n');
}

// ─── Modular: sub-composition document ───────────────────────────────
// Everything (style, markup, script) lives inside <template>: the runtime
// only clones template content, so anything outside it is dropped.
function buildSubComposition(config, scene, instance) {
  const varsJSON = varsJSONFor(config, instance.variables);
  const W = config.width || 1920;
  const H = config.height || 1080;
  const FPS = config.fps || 30;

  const timeline = [`const tl = gsap.timeline({ paused: true, defaults: ${timelineDefaults(config)} });`];
  collectAnimLines(scene.elements, 0, timeline);
  timeline.push(`window.__timelines["${scene.id}"] = tl;`);

  const varsAttr = varsJSON ? ` data-composition-variables='${attrJSON(varsJSON)}'` : '';

  return `<!DOCTYPE html>
<html lang="${config.language || 'zh-CN'}">
<head>
<meta charset="UTF-8">
<title>${esc(config.title || 'JSON2Hyperframes')} — ${scene.id}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head>
<body>
<template>
<style>
${buildStyles(config, { scoped: true })}
</style>
<div id="root" data-composition-id="${scene.id}" data-start="0" data-width="${W}" data-height="${H}" data-fps="${FPS}" data-duration="${scene.duration}"${varsAttr}>
${renderScene(scene, config, { localStart: true })}
</div>
<script>
window.__timelines = window.__timelines || {};
${timeline.join('\n')}
</script>
</template>
</body>
</html>`;
}

// ─── Public API ──────────────────────────────────────────────────────
export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Generate composition files from a config.
 * @returns {{files: string[], config: object}}
 */
export function generate(config, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const written = [];

  if (config.architecture === 'modular') {
    const sub = config.subCompositions || {};
    const directory = sub.directory || 'compositions';
    const instances = sub.scenes || [];
    const sceneById = new Map(config.scenes.map(s => [s.id, s]));

    for (const inst of instances) {
      if (!sceneById.has(inst.sceneId)) {
        throw new Error(`subCompositions.scenes references unknown sceneId: "${inst.sceneId}"`);
      }
    }

    const subDir = path.join(outputDir, directory);
    fs.mkdirSync(subDir, { recursive: true });
    for (const inst of instances) {
      const scene = sceneById.get(inst.sceneId);
      const file = path.join(subDir, `${inst.sceneId}.html`);
      fs.writeFileSync(file, buildSubComposition(config, scene, inst), 'utf8');
      written.push(file);
    }

    const hostFile = path.join(outputDir, 'index.html');
    fs.writeFileSync(hostFile, buildModularHost(config, instances, directory), 'utf8');
    written.unshift(hostFile);
  } else {
    const outFile = path.join(outputDir, 'index.html');
    fs.writeFileSync(outFile, buildMonolithic(config), 'utf8');
    written.push(outFile);
  }

  return { files: written, config };
}

/** CLI entry: read config from cwd, write into <cwd>/output. */
export async function runGenerate(configArg, { outputDir } = {}) {
  const cwd = process.cwd();
  const configPath = path.resolve(cwd, configArg);

  if (!fs.existsSync(configPath)) {
    console.error(`✗ Config not found: ${configPath}`);
    console.error('  Run "j2hf init <name>" to create a project, or pass --config=<path>.');
    process.exit(1);
  }

  const config = loadConfig(configPath);
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error(`✗ Config validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}):`);
    for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
    process.exit(1);
  }

  const outDir = path.resolve(cwd, outputDir || 'output');
  const { files } = generate(config, outDir);

  console.log(`✅ Generated ${files.length} file${files.length > 1 ? 's' : ''} (${config.architecture || 'monolithic'}):`);
  for (const f of files) console.log(`   ${path.relative(cwd, f)}`);
  console.log(`   Scenes: ${config.scenes.length}  Duration: ${config.duration || 'auto'}s  Size: ${config.width || 1920}x${config.height || 1080}`);
  console.log('\nNext: j2hf preview');
}
