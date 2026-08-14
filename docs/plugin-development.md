# j2hf 插件开发指南

> 面向第三方开发者。读完本文，你可以从零写出可发布到 npm 的 j2hf 插件。
>
> 适用版本：j2hf ≥ 1.0.4 · Node ≥ 18 · ESM

---

## 1. 核心理念

j2hf 故意把渲染内核做得极小——**只负责 JSON → HTML + GSAP 时间线的确定性生成**。它不做图表、不做 Lottie、不做 3D、不做地图。这些「视觉富组件」全部留给插件补齐。

这样做有两个好处：

1. **内核稳定**：核心 7 种元素（text / image / shape / group / video / audio / icon）的渲染逻辑固定，不随业务膨胀。
2. **插件即能力**：你写的每一个插件，都在扩展 j2hf 能表达的画面词汇。用户只需在 `video-config.json` 里写一行 `"plugins": ["你的包名"]`，就能用上你的能力，无需 `import`、无需手动注册。

插件可以在三个时机介入生成流程：

| 时机 | 钩子 | 能干什么 |
|------|------|---------|
| 生成前 | `beforeGenerate` | 改写配置、注入默认值、拉取远程数据、校验自定义字段 |
| 渲染时 | `registerElements` | 注册自定义元素类型，接管该类型的 HTML 输出 |
| 生成后 | `afterGenerate` | 读写已生成的 `index.html`，注入时间线 tween、追加 `<script>` / `<link>` 等 |

这三条路径覆盖了「加一种新元素」「加一段动画」「加一份外部资源」三种最高频的扩展诉求。

---

## 2. 三十秒上手：最小可用插件

```js
// my-plugin.mjs
export default {
  name: 'my-plugin',

  registerElements() {
    return {
      // 注册一个名为 "badge" 的自定义元素类型
      badge: {
        render(element /*, scene */) {
          const id = element.id;
          const text = element.content || '';
          const bg = element.color || 'var(--accent)';
          return `<div id="${id}" style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:#fff;font-size:14px;">${text}</div>`;
        }
      }
    };
  }
};
```

在 `video-config.json` 里引用：

```json
{
  "plugins": ["./my-plugin.mjs"],
  "scenes": [{
    "id": "s1", "start": 0, "duration": 3,
    "elements": [
      { "type": "badge", "id": "tag", "content": "NEW", "style": { "position": "absolute", "top": 100, "left": 100 } }
    ]
  }]
}
```

运行 `j2hf generate`，引擎会：

1. 读到 `plugins` 字段 → 动态 `import("./my-plugin.mjs")` → 取 `default` 导出 → 调用 `globalRegistry.register(plugin)`。
2. 渲染时遇到 `type: "badge"` → 先查插件注册表，命中后用你的 `render()` 出 HTML。
3. 校验时发现 `type: "badge"` 不在内置 7 种里 → 但因为它已被注册，校验器**自动跳过**该元素的 schema 校验（详见第 6 节）。

这就是全部。没有 build step、没有注册 API 调用——配置里写上，就能用。

---

## 3. 插件加载流程

理解加载顺序很重要，因为它决定了你的钩子何时能拿到什么东西。

```
runGenerate(configPath)
  │
  ├─ 1. loadConfig(configPath)            // JSON.parse 配置文件
  ├─ 2. loadPlugins(rawConfig)            // 遍历 config.plugins，逐个 import + register
  │      └─ globalRegistry.register(plugin)
  │         └─ 若 plugin.registerElements 存在 → 立即调用，把返回的 {type: renderer} 并入注册表
  ├─ 3. validateConfig(rawConfig)        // AJV 校验，但跳过已注册插件元素类型的路径
  ├─ 4. generate(rawConfig, outputDir)
  │      ├─ globalRegistry.runBeforeGenerate(config)   // 依次（顺序）调用每个插件的 beforeGenerate
  │      ├─ 渲染 HTML（monolithic / modular）
  │      └─ globalRegistry.runAfterGenerate(ctx)        // 依次调用每个插件的 afterGenerate
  └─ 5. 返回 { files, config }
```

关键点：

- **`registerElements` 在注册时立即执行**，远早于 `beforeGenerate` 和渲染。所以你的元素类型在 `beforeGenerate` 运行时已经在注册表里了。
- **`beforeGenerate` 按数组顺序串行执行**，上一个插件的返回值就是下一个插件的入参（pipeline 模式）。
- **`afterGenerate` 同样按顺序串行**，但此时 HTML 已经落盘，你能直接读写 `index.html`。
- **插件渲染器优先于内置类型**：如果你注册了一个 `type: "text"` 的渲染器，它会**覆盖**内置的 text 渲染。慎用。

### 3.1 插件 specifier 写法

`config.plugins` 数组的每一项是一个字符串，引擎按以下顺序解析：

1. 先当作 **npm 包名** `import(name)`——如果成功就用。
2. 失败则当作**本地路径**（相对 cwd），用 `pathToFileURL(path.resolve(cwd, name))` 再 `import`。

所以这三种写法都合法：

```json
"plugins": ["./my-plugin.mjs"]                        // 本地文件
"plugins": ["j2hf-chart"]                              // npm 包（需先 npm install）
"plugins": ["j2hf-chart", "./local/custom-tweak.mjs"] // 混用
```

> 提示：发布到 npm 的插件请以 `j2hf-` 前缀命名，方便用户辨认。

---

## 4. 三个扩展点详解

### 4.1 `beforeGenerate(config) → VideoConfig | Promise<VideoConfig>`

**时机**：验证之后、渲染之前。此时配置已经通过 JSON schema 校验（你的自定义元素已被旁路），你可以安全地读取、改写它。

**能做**：

- 注入默认值（例如给所有 `progress` 元素补上缺失的 `fillColor`）。
- 审计配置（统计元素数量、计算总时长）。
- 拉取异步数据（`async` 函数，例如根据 `element.dataSource` 去取 API 数据后写回 `element.content`）。
- 校验插件私有字段（schema 旁路意味着你的字段不会被 AJV 检查，你需要在 `beforeGenerate` 里自己做）。

**签名**：

```typescript
beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
```

**务必返回 config**（同步直接 `return config`，异步 `return await ...`）。引擎用返回值替换内部 config 对象，不返回会导致后续流程拿到 `undefined`。

**示例**：

```js
beforeGenerate(config) {
  // 给所有自定义 chart 元素补默认调色板
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !el.palette) {
        el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b'];
      }
    }
  }
  return config;
}
```

### 4.2 `registerElements() → Record<string, ElementRenderer>`

**时机**：插件注册时（`loadPlugins` 阶段），远早于 `beforeGenerate`。

**返回**：一个 `{ 元素类型名: ElementRenderer }` 的映射表。每个 `ElementRenderer` 的形状是：

```typescript
interface ElementRenderer {
  render: (element: any, scene: any) => string;
  //                                       └─ 返回一段 HTML 字符串
}
```

引擎在渲染每个元素时，**先查插件注册表**：

```typescript
// generate.ts 核心逻辑
const customRenderer = globalRegistry.getRenderer(el.type);
if (customRenderer) {
  return customRenderer.render(el, config);   // 命中插件 → 直接用，不走内置 switch
}
// ... 否则走内置 text/image/shape/group/video/audio/icon
```

**`render(element, scene)` 参数**：

| 参数 | 类型 | 含义 |
|------|------|------|
| `element` | `any` | 当前元素对象（你在 JSON 里写的那个对象原样传入，含 `type`、`id`、`style` 以及你自定义的所有字段） |
| `scene`（第二参数） | `any` | 当前所属 scene 对象（注意：实际传入的是 `config`，见下方注意事项） |

> ⚠️ **签名注意事项**：当前引擎实际调用的是 `customRenderer.render(el, config)`——第二个参数传的是**整个 `VideoConfig`** 而非 scene。`types.ts` 里的类型标注为 `scene`，但运行时值是 `config`。如果你需要访问 scene 信息（如 `scene.start`），请从 element 的父级路径自行解析，或依赖 `beforeGenerate` 把 scene 级信息写到元素上。

**你返回的 HTML 约定**：

- 必须包含 `id="${element.id}"`——时间线动画和 `afterGenerate` 注入都靠这个 id 定位元素。
- 返回纯 HTML 字符串即可，引擎不做二次处理。
- 元素的 `style` 字段不会自动应用——你需要自己把 `element.style` 转成内联样式（见第 8 节的样式转换助手）。
- 如果你的元素需要动画，确保内部动画目标有可定位的 `id`（例如 `<div id="bar-fill">`），方便 `afterGenerate` 注入 tween 或用户在 config 里写 `animations`。

**示例**：

```js
registerElements() {
  return {
    chart: {
      render(element, config) {
        const id = element.id;
        const w = element.width || 400;
        const h = element.height || 300;
        const data = element.data || [];
        const bars = data.map((d, i) =>
          `<rect x="${i * 40}" y="${h - d}" width="30" height="${d}" fill="var(--accent)"/>`
        ).join('');
        return `<svg id="${id}" width="${w}" height="${h}" style="overflow:visible">
  ${bars}
</svg>`;
      }
    }
  };
}
```

### 4.3 `afterGenerate(ctx: PluginContext) → void | Promise<void>`

**时机**：HTML 已写盘之后。

**`PluginContext`**：

```typescript
interface PluginContext {
  config: VideoConfig;   // 经过 beforeGenerate 处理后的最终 config
  outputDir: string;     // 输出目录的绝对路径（默认 <cwd>/output）
}
```

**能做**：

- 读取 `outputDir/index.html`，向 GSAP 时间线注入额外的 tween。
- 追加外部资源（`<link>` CSS、`<script>` 库文件、`<svg>` defs）。
- 生成附属文件（例如把 chart 数据导出为 `data.json` 放到输出目录）。
- 对 modular 架构的子合成文件做处理（注意此时输出目录下可能有 `compositions/*.html`）。

**时间线注入模式**（这是 `afterGenerate` 最核心的应用场景）：

引擎生成的 `index.html` 里有一段 GSAP 时间线，结尾是这行锚点：

```javascript
window.__timelines["<compositionId>"] = tl;
```

你可以在这行**之前**插入你的 tween，它们就会在时间线注册前被执行：

```js
import fs from 'node:fs';
import path from 'node:path';

afterGenerate(ctx) {
  const cid = ctx.config.compositionId || 'main';
  const idx = path.join(ctx.outputDir, 'index.html');
  if (!fs.existsSync(idx)) return;

  const anchor = `window.__timelines["${cid}"] = tl;`;
  let html = fs.readFileSync(idx, 'utf8');
  if (!html.includes(anchor)) return;

  const tween = `tl.to("#my-element", { width: "100%", duration: 2, ease: "power2.inOut" }, 0.5);`;
  html = html.replace(anchor, tween + '\n' + anchor);
  fs.writeFileSync(idx, html);
}
```

> **modular 架构注意**：modular 模式下时间线分散在 `compositions/*.html` 子文件里，锚点格式相同但文件不同。如果你想兼容 modular，需要遍历 `ctx.config.subCompositions.scenes`，逐个文件处理。

---

## 5. 内置元素类型（你不需要重复造的轮子）

在写插件前，先了解内核已经能渲染什么，避免重复造轮子。以下是 7 种内置元素类型及其能力：

| 类型 | 核心能力 | 关键属性 |
|------|---------|---------|
| `text` | 文本渲染，支持完整排版 | `content`、`typography`（fontSize / color / textAlign / letterSpacing / fontFamily / fontWeight / textTransform / lineHeight / maxWidth / fontVariantNumeric）、`varBindings.varText`（绑定变量声明） |
| `image` | 图片，带加载兜底 | `src`、`fit`（object-fit）、`radius`（圆角 px）、`fallbackSrc`（onerror 兜底）、`varBindings.varSrc` |
| `shape` | 基础形状 | `kind`（rect / circle / ellipse / line）、`backgroundColor`、`border`、`radius`（非圆形时生效） |
| `group` | 容器 + flex 布局 | `layout: "flex"` 后支持 `flexDirection` / `gap` / `align` / `justify`，递归渲染 `children` |
| `video` | 视频元素 | `src`、`muted`、`playsinline`、`data-media-start`、`data-volume`、`hasAudio`、`crossOrigin` |
| `audio` | 音频轨道 | `src`、`data-media-start`、`data-volume`，配合 `audioTracks` 的 `fades` 做淡入淡出 |
| `icon` | 图标 | `size`、`color` |

**所有元素共有的字段**：

- `id`（必填）—— 元素唯一标识，动画和时间线注入靠它定位
- `style`（可选）—— 内联样式对象，支持驼峰 key，内部自动转 kebab-case 并对长度属性自动加 `px`
- `animations`（可选）—— GSAP 动画数组，内核自动生成 `tl.to` / `tl.from` / `tl.fromTo` 时间线代码
- `varBindings`（可选）—— 变量绑定，输出 `data-*` 属性配合 HyperFrames 变量系统
- `hidden`（可选）—— 输出 `data-hidden="true"`
- `layoutAudit`（可选）—— 输出 `data-layout-*` 审计属性

**如果你需要的能力在以上范围内，直接用内置类型，不需要写插件。** 插件用于补充这些之外的能力（见第 9 节）。

---

## 6. 校验旁路机制（你的自定义类型能通过 schema 校验）

j2hf 用 JSON Schema（AJV，draft-07）做严格校验。根对象和每种内置元素都设置了 `additionalProperties: false`，意味着**未知字段会报错**。

但插件元素类型（比如 `badge`、`chart`、`progress`）不在 schema 的 `oneOf` 里，理论上会被 AJV 判为「不匹配任何已知类型」。引擎通过一个叫 `collectPluginElementPaths` 的函数解决这个问题：

1. 渲染前（`loadPlugins` 阶段），你的 `registerElements()` 已经执行，注册表里有了 `badge`。
2. `validateConfig` 内部调用 `collectPluginElementPaths(config)`：递归遍历所有 scene 的 elements，凡是 `globalRegistry.getRenderer(el.type)` 能命中的，记录该元素的 JSON 路径（如 `/scenes/0/elements/1`）。
3. AJV 跑完后，落在这些路径上 / 路径下的错误被**丢弃**。

效果：你的自定义元素及其子字段不会被内置 schema 拦截，你可以自由定义任意字段结构。

**但你必须自己做校验**：schema 旁路意味着 AJV 不会检查你的字段。如果你需要对自定义字段做约束（比如 `chart` 必须有 `data` 数组），在 `beforeGenerate` 里手动检查：

```js
beforeGenerate(config) {
  for (const scene of config.scenes || []) {
    for (const el of scene.elements || []) {
      if (el.type === 'chart' && !Array.isArray(el.data)) {
        throw new Error(`chart 元素 "${el.id}" 缺少必填的 data 数组`);
      }
    }
  }
  return config;
}
```

> 注意：根对象仍受 schema 约束——`additionalProperties: false`。你的自定义字段只能写在**元素对象内**，不能加在 config 根层级。根级扩展目前只能通过 `VideoConfig` 的 `[key: string]: any` 索引签名（引擎不拦截），但 schema 会拦截——所以根级扩展暂不支持，请把所有自定义信息放在元素或 scene 上。

---

## 7. 样式转换助手（复用内核的约定）

内置元素用两个工具函数处理 `style` 对象，你的插件 `render()` 最好沿用相同约定，产出一致的 CSS：

### 7.1 kebab-case 转换

```js
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
// fontSize → font-size
// borderRadius → border-radius
// zIndex → z-index
```

### 7.2 长度属性自动加 px

以下属性当值为数字时自动追加 `px` 单位，其他属性的数字保持原样：

```js
const LENGTH_PROPS = new Set([
  'fontSize', 'maxWidth', 'width', 'height', 'top', 'left', 'right', 'bottom',
  'gap', 'padding', 'margin', 'lineHeight', 'borderRadius', 'borderWidth'
]);
```

### 7.3 完整的 styleStr 助手

你可以直接复制这段代码到插件里使用：

```js
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
const LENGTH_PROPS = new Set([
  'fontSize','maxWidth','width','height','top','left','right','bottom',
  'gap','padding','margin','lineHeight','borderRadius','borderWidth'
]);
const styleStr = (obj) =>
  obj ? Object.entries(obj)
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' && LENGTH_PROPS.has(k) ? v + 'px' : v}`)
    .join('; ') : '';
```

在 `render()` 里用法：

```js
render(element) {
  const s = styleStr(element.style);
  return `<div id="${element.id}"${s ? ` style="${s}"` : ''}>…</div>`;
}
```

> 注意：`opacity`、`zIndex`、`fontWeight` 等属性的数字值**不加** px——上面的 `LENGTH_PROPS` 集合已排除它们。这与内置元素行为一致。

---

## 8. 完整实战：从零写一个 chart 插件

下面用一个「柱状图」插件演示三个钩子的协同。这个插件会：
1. `beforeGenerate`：给 chart 元素补默认调色板、校验 `data` 字段。
2. `registerElements`：注册 `chart` 类型，渲染 SVG 柱状图。
3. `afterGenerate`：向时间线注入「柱子依次长出」的 stagger 动画。

### 8.1 插件代码

```js
// j2hf-chart.mjs
import fs from 'node:fs';
import path from 'node:path';

const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
const LENGTH_PROPS = new Set(['width','height','top','left','right','bottom','gap','fontSize']);
const styleStr = (obj) =>
  obj ? Object.entries(obj)
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' && LENGTH_PROPS.has(k) ? v + 'px' : v}`)
    .join('; ') : '';

export default {
  name: 'j2hf-chart',

  // ── 钩子 1：生成前，校验 + 注入默认值 ──
  beforeGenerate(config) {
    for (const scene of config.scenes || []) {
      for (const el of scene.elements || []) {
        if (el.type !== 'chart') continue;

        // 校验
        if (!Array.isArray(el.data)) {
          throw new Error(`[j2hf-chart] 元素 "${el.id}" 缺少必填的 data 数组`);
        }

        // 注入默认值
        if (!el.palette) {
          el.palette = config.palette?.neutral || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        }
        if (!el.barWidth) el.barWidth = 60;
        if (!el.gap) el.gap = 20;
      }
    }
    return config;
  },

  // ── 钩子 2：注册自定义元素类型 ──
  registerElements() {
    return {
      chart: {
        render(element /*, config */) {
          const id = element.id;
          const data = element.data;
          const palette = element.palette;
          const barWidth = element.barWidth;
          const gap = element.gap;
          const w = element.width || data.length * (barWidth + gap);
          const h = element.height || 300;
          const maxVal = Math.max(...data.map(d => d.value), 1);

          const bars = data.map((d, i) => {
            const barH = (d.value / maxVal) * h;
            const x = i * (barWidth + gap);
            const y = h - barH;
            const color = palette[i % palette.length];
            // 每根柱子有独立 id，供 afterGenerate 动画定位
            return `<rect id="${id}-bar-${i}" x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="4" style="transform-origin:${x + barWidth/2}px ${y}px"/>`;
          }).join('');

          const labels = data.map((d, i) => {
            const x = i * (barWidth + gap) + barWidth / 2;
            return `<text x="${x}" y="${h + 20}" text-anchor="middle" fill="var(--foreground)" font-size="14">${d.label || ''}</text>`;
          }).join('');

          const s = styleStr(element.style);
          return `<svg id="${id}" width="${w}" height="${h + 40}"${s ? ` style="${s};overflow:visible"` : ' style="overflow:visible"'}>
  ${bars}
  ${labels}
</svg>`;
        }
      }
    };
  },

  // ── 钩子 3：生成后，注入 stagger 动画 ──
  afterGenerate(ctx) {
    const cid = ctx.config.compositionId || 'main';
    const idx = path.join(ctx.outputDir, 'index.html');
    if (!fs.existsSync(idx)) return;

    const lines = [];
    for (const scene of ctx.config.scenes || []) {
      for (const el of scene.elements || []) {
        if (el.type !== 'chart') continue;

        const at = el.animateAt ?? scene.start ?? 0;
        const stagger = el.stagger ?? 0.1;
        const dur = el.barDuration ?? 0.6;

        // 每根柱子从 scaleY:0 长出来
        for (let i = 0; i < el.data.length; i++) {
          lines.push(`tl.from("#${el.id}-bar-${i}", { scaleY: 0, duration: ${dur}, ease: "power3.out" }, ${at + i * stagger});`);
        }
      }
    }

    if (!lines.length) return;

    let html = fs.readFileSync(idx, 'utf8');
    const anchor = `window.__timelines["${cid}"] = tl;`;
    if (!html.includes(anchor)) return;

    html = html.replace(anchor, lines.join('\n') + '\n' + anchor);
    fs.writeFileSync(idx, html);
    console.log(`  [j2hf-chart] 注入了 ${lines.length} 条柱子弹出动画`);
  }
};
```

### 8.2 对应的配置

```json
{
  "$schema": "../schemas/video-config.schema.json",
  "compositionId": "chart-demo",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "plugins": ["./j2hf-chart.mjs"],
  "palette": {
    "background": "#0f172a",
    "foreground": "#e2e8f0",
    "accent": "#3b82f6"
  },
  "scenes": [{
    "id": "s1",
    "start": 0,
    "duration": 4,
    "elements": [{
      "type": "chart",
      "id": "sales-chart",
      "data": [
        { "label": "Q1", "value": 30 },
        { "label": "Q2", "value": 65 },
        { "label": "Q3", "value": 45 },
        { "label": "Q4", "value": 80 }
      ],
      "width": 400,
      "height": 250,
      "barWidth": 60,
      "gap": 20,
      "stagger": 0.15,
      "barDuration": 0.6,
      "style": { "position": "absolute", "top": 400, "left": 200 }
    }]
  }]
}
```

### 8.3 运行

```bash
j2hf generate
```

你会看到 `[j2hf-chart] 注入了 4 条柱子弹出动画`，并且生成的页面里柱子会依次从底部弹出。

---

## 9. 核心已有的能力 vs 还需要插件补齐的

### 9.1 核心已有（不需要插件）

| 领域 | 能力 |
|------|------|
| 布局 | 绝对定位、flex 容器（group + layout）、嵌套子元素递归渲染 |
| 文本 | 完整排版属性（字号 / 字重 / 字间距 / 行高 / 对齐 / 变体）、变量绑定 |
| 媒体 | 图片（含兜底）、视频（含跨域 / 音量控制）、音频（含淡入淡出） |
| 形状 | 矩形 / 圆形 / 椭圆 / 线条、边框、圆角 |
| 动画 | GSAP 时间线全量支持（to / from / fromTo）、递归元素动画收集、scene 级背景动画 |
| 转场 | 6 种已实现：crossfade、blur-crossfade、zoom-through、zoom-out、push-slide、color-dip-black |
| 变量 | CSS 变量声明与自动注入、per-composition 作用域 |
| 架构 | monolithic（单文件）和 modular（主合成 + 子合成）两种输出模式 |
| 校验 | JSON Schema 严格校验 + 插件元素自动旁路 |

### 9.2 还需要插件补齐的（明确的缺口）

以下是核心**故意不做**、留给生态补齐的方向。欢迎认领：

#### 🔴 高价值缺口

| 方向 | 描述 | 涉及钩子 |
|------|------|---------|
| **图表** | 柱状图、折线图、饼图、面积图。最佳方案：`registerElements` 渲染 SVG，`afterGenerate` 注入绘制动画 | 全部三个 |
| **Lottie 动画** | 渲染 `<lottie-player>` 容器，`afterGenerate` 注入 lottie-web 脚本和播放控制 | `registerElements` + `afterGenerate` |
| **3D / WebGL** | 渲染 `<canvas>` 容器，`afterGenerate` 注入 Three.js 代码和进入时间线的渲染循环 | `registerElements` + `afterGenerate` |
| **地图** | 渲染容器，`afterGenerate` 注入 Leaflet / Mapbox GL 的初始化脚本 | `registerElements` + `afterGenerate` |
| **二维码** | 渲染 `<img>` 或 `<svg>`，可直接在 `registerElements` 里用 `qrcode` npm 包同步生成，无需 `afterGenerate` | `registerElements` |

#### 🟡 中价值缺口

| 方向 | 描述 | 涉及钩子 |
|------|------|---------|
| **更多转场** | schema 定义了 27 种转场，但只实现了 6 种。剩余 21 种（glitch、ripple、staggered-blocks、clock-wipe 等）需要插件补齐。可以实现为 `afterGenerate` 的时间线注入 | `afterGenerate` |
| **资源子集** | 按场景裁剪实际用到的图片 / 字体 / 视频，减小输出体积。适合做 `beforeGenerate` 分析 + `afterGenerate` 文件操作 | `beforeGenerate` + `afterGenerate` |
| **代码高亮** | 渲染 `<pre><code>` + `afterGenerate` 注入 highlight.js / Prism 脚本 | `registerElements` + `afterGenerate` |
| **数学公式** | 渲染容器 + `afterGenerate` 注入 KaTeX / MathJax | `registerElements` + `afterGenerate` |
| **Markdown 渲染** | 把 `element.content` 里的 Markdown 转 HTML 输出，可在 `registerElements` 同步完成 | `registerElements` |

#### 🟢 未来缺口

| 方向 | 描述 |
|------|------|
| **WebGL Shader 转场** | schema 的 `transitionConfig.shader` 字段已预留（注释注明 "Reserved for future WebGL shader transitions. Not implemented in v1."），等待插件实现 |
| **modular 子合成注入** | 当前 `afterGenerate` 主要针对 `index.html`。modular 模式下子合成文件（`compositions/*.html`）的动画注入需要遍历处理，目前没有现成模式 |
| **字体子集化** | 根据实际用到的字符裁剪 woff2，减小体积 |

### 9.3 如果你要认领一个方向

建议的插件命名约定：

```
j2hf-<能力名>        // 如 j2hf-chart, j2hf-lottie, j2hf-qrcode
```

`package.json` 关键字段：

```json
{
  "name": "j2hf-chart",
  "type": "module",
  "main": "dist/index.mjs",
  "exports": {
    ".": {
    "import": "./dist/index.mjs"
    }
  },
  "peerDependencies": {
    "j2hf": ">=1.0.4"
  }
}
```

插件入口只需 `export default` 一个 `J2hfPlugin` 对象：

```js
// dist/index.mjs
export default {
  name: 'j2hf-chart',
  beforeGenerate(config) { /* ... */ return config; },
  registerElements() { return { chart: { render(el) { /* ... */ } } }; },
  afterGenerate(ctx) { /* ... */ }
};
```

发布：

```bash
npm publish
```

用户使用：

```bash
npm install j2hf-chart
```

```json
{ "plugins": ["j2hf-chart"] }
```

---

## 10. API 参考

### 10.1 `J2hfPlugin`（插件对象形状）

```typescript
interface J2hfPlugin {
  /** 插件名，必填，用于日志和调试 */
  name: string;

  /** 生成前钩子：改写 / 校验 / 异步取数。务必返回 config */
  beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;

  /** 注册自定义元素类型。返回 { 类型名: ElementRenderer } */
  registerElements?: () => Record<string, ElementRenderer>;

  /** 生成后钩子：读写已生成的 HTML、注入资源 / 动画 */
  afterGenerate?: (ctx: PluginContext) => void | Promise<void>;
}
```

### 10.2 `ElementRenderer`（元素渲染器）

```typescript
interface ElementRenderer {
  /**
   * @param element  当前元素对象（JSON 原样，含 id / style / 自定义字段）
   * @param config   整个 VideoConfig（注：类型标注写的是 scene，实际值是 config）
   * @returns        HTML 字符串
   */
  render: (element: any, config: any) => string;
}
```

### 10.3 `PluginContext`（afterGenerate 上下文）

```typescript
interface PluginContext {
  config: VideoConfig;   // 经 beforeGenerate 处理后的最终 config
  outputDir: string;      // 输出目录绝对路径
}
```

### 10.4 `VideoConfig`（配置对象，完整字段）

```typescript
interface VideoConfig {
  width?: number;                    // 画布宽，默认 1920
  height?: number;                   // 画布高，默认 1080
  fps?: number;                      // 帧率，默认 30
  compositionId?: string;            // 合成 ID，必填，用于时间线注册
  architecture?: 'monolithic' | 'modular';  // 输出架构，默认 monolithic
  subCompositions?: { scenes?: any[] };     // modular 模式下的子合成定义
  palette?: {
    background?: string;
    foreground?: string;
    accent?: string;
    neutral?: string[];
    themeRef?: string;
  };
  typography?: { bodyFont?: string; headlineFont?: string };
  variables?: { declarations?: Array<{ id: string; type: string; default: any }> };
  renderSettings?: { output?: string; quality?: string; fps?: number; strict?: boolean };
  plugins?: string[];               // 插件 specifier 数组（npm 名 / 本地路径）
  scenes?: Scene[];                  // 场景数组（必填）
  audioTracks?: AudioTrack[];        // 音频轨道
  [key: string]: any;                // 索引签名（引擎允许，但 schema 根级不允许未知字段）
}
```

### 10.5 从 j2hf 导入类型（用于 TypeScript 插件）

```typescript
import type { J2hfPlugin, ElementRenderer, PluginContext, VideoConfig } from 'j2hf';
```

这些类型从 `j2hf` 包的 `dist/lib/generate.d.ts` 重新导出（`generate.ts` 里 `export * from './types.js'`）。

### 10.6 编程式调用（不用 CLI 也能跑插件）

```typescript
import { runGenerate } from 'j2hf';

await runGenerate('video-config.json', { outputDir: 'output' });
```

或更底层：

```typescript
import { loadConfig, generate, globalRegistry } from 'j2hf';

// 手动注册插件（跳过 config.plugins 声明）
import myPlugin from './my-plugin.mjs';
globalRegistry.register(myPlugin);

const config = loadConfig('video-config.json');
const { files, config: finalConfig } = await generate(config, 'output');
```

---

## 11. 调试技巧

### 11.1 查看插件是否被加载

运行 `j2hf generate` 时，控制台会打印：

```
• Loaded plugin: j2hf-progress +customElements +beforeGenerate +afterGenerate
```

如果没看到这行，说明 specifier 没解析成功。

### 11.2 查看生成的 HTML

```bash
j2hf generate
# 输出在 output/index.html
cat output/index.html | grep "<your-element-id>"
```

### 11.3 验证时间线注入

```bash
grep "window.__timelines" output/index.html
# 检查你的 tween 是否出现在这行之前
```

### 11.4 常见错误排查

| 错误 | 原因 | 解决 |
|------|------|------|
| `✗ Failed to load plugin: "xxx"` | npm 包未安装 / 本地路径不对 | `npm install xxx` 或检查相对路径是否相对 cwd |
| `✗ Plugin "xxx" did not export a valid J2hfPlugin (missing .name)` | 导出对象没有 `name` 字段 | 确保 `export default { name: '...', ... }` |
| 元素渲染为 `<!-- Unknown element type: xxx -->` | `registerElements` 没返回该类型，或类型名拼写不一致 | 检查 `registerElements()` 返回的 key 和 config 里的 `type` 是否完全一致 |
| 校验报错出现在你的自定义元素上 | 该元素的 type 没被注册（旁路未触发） | 确认插件先于 `validateConfig` 加载——它在 `loadPlugins` 阶段注册，应早于校验 |
| `afterGenerate` 里 `anchor not found` | compositionId 不匹配，或文件不是 `index.html`（modular 模式） | 检查 `ctx.config.compositionId`；modular 模式需遍历 `compositions/*.html` |

---

## 12. 参考实现

仓库内附带的 `examples/plugins/j2hf-progress.mjs` 是一个生产可用的最小插件示范，同时使用了全部三个钩子。建议先读一遍它的源码，再开始写你自己的插件。

对应的配置示例在 `examples/plugin-demo.json`，运行方式：

```bash
j2hf generate --config examples/plugin-demo.json
j2hf preview
```

---

## 附录：术语对照

| j2hf 术语 | 含义 |
|-----------|------|
| composition | 一个完整作品（对应一个 `compositionId` 和一条 GSAP 时间线） |
| scene | 合成中的一个场景片段（`clip`），有自己的 `start` / `duration` |
| element | scene 内的具体元素（text / image / shape / ...） |
| clip | 生成的 HTML 中每个 scene 的外层容器，`<section class="clip" id="clip-<id>">` |
| timeline | 引擎生成的 GSAP 时间线对象，存在 `window.__timelines[compositionId]` |
| modular | 多文件输出架构，主合成引用子合成的 HTML |
| plugin | 一个 `J2hfPlugin` 对象，通过 `config.plugins` 声明后自动加载 |
