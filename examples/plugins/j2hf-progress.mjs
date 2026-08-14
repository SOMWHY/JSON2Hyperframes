/**
 * j2hf-progress — 示范插件
 *
 * 演示一个插件如何同时用到全部三个扩展点：
 *   1. beforeGenerate       —— 读取/审计配置（这里统计 progress 元素数量）
 *   2. registerElements      —— 注册自定义元素类型 `progress`，渲染为轨道 + 填充条
 *   3. afterGenerate        —— 生成完成后，向 index.html 的时间线注入驱动填充条的 tween
 *
 * 用法：在 video-config.json 里写
 *   "plugins": ["./examples/plugins/j2hf-progress.mjs"]
 * 再 j2hf generate 即可。无需手动 import / register。
 */
import fs from 'node:fs';
import path from 'node:path';

export default {
  name: 'j2hf-progress',

  beforeGenerate(config) {
    const bars = (config.scenes || [])
      .flatMap(s => s.elements || [])
      .filter(e => e.type === 'progress').length;
    console.log(`  [progress] beforeGenerate: ${bars} progress bar(s) detected`);
    return config;
  },

  registerElements() {
    return {
      progress: {
        render(element /*, scene */) {
          const id = element.id;
          const style = element.style || {};
          const css = Object.entries(style).map(([k, v]) => {
            const kebab = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
            const val = (typeof v === 'number' && !/opacity|zIndex|delay|duration/.test(k)) ? v + 'px' : v;
            return `${kebab}: ${val}`;
          }).join('; ');

          const height = element.height ?? 8;
          const radius = element.radius ?? 4;
          const trackColor = element.trackColor || 'rgba(255,255,255,0.08)';
          const fillColor = element.fillColor || 'var(--accent)';

          return `<div id="${id}" data-progress style="width:100%; height:${height}px; background:${trackColor}; border-radius:${radius}px; overflow:hidden; ${css}">
  <div id="${id}-fill" style="height:100%; width:0%; background:${fillColor}; border-radius:inherit;"></div>
</div>`;
        }
      }
    };
  },

  afterGenerate(ctx) {
    const cid = ctx.config.compositionId || 'main';
    const idx = path.join(ctx.outputDir, 'index.html');
    if (!fs.existsSync(idx)) {
      console.log('  [progress] afterGenerate: no index.html (modular host?) — skip injection');
      return;
    }

    const lines = [];
    for (const sc of (ctx.config.scenes || [])) {
      for (const el of (sc.elements || [])) {
        if (el.type !== 'progress') continue;
        const to = el.to ?? '100%';
        const dur = el.duration ?? 2;
        const ease = el.ease || 'power2.inOut';
        const at = el.at ?? (sc.start ?? 0);
        const toVal = typeof to === 'string' ? JSON.stringify(to) : to;
        lines.push(`tl.to("#${el.id}-fill", { width: ${toVal}, duration: ${dur}, ease: "${ease}" }, ${at});`);
      }
    }

    if (!lines.length) {
      console.log('  [progress] afterGenerate: no progress bars — nothing to inject');
      return;
    }

    let html = fs.readFileSync(idx, 'utf8');
    const anchor = `window.__timelines["${cid}"] = tl;`;
    if (!html.includes(anchor)) {
      console.log(`  [progress] afterGenerate: anchor "${anchor}" not found — skip injection`);
      return;
    }
    html = html.replace(anchor, lines.join('\n') + '\n' + anchor);
    fs.writeFileSync(idx, html);
    console.log(`  [progress] afterGenerate: injected ${lines.length} tween(s) into ${path.relative(process.cwd(), idx)}`);
  }
};
