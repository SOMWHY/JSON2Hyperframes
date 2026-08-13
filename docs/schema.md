# JSON2Hyperframes Schema 文档

## 字段 ↔ HyperFrames 契约映射表

> 本表定义 `video-config.json` 每个字段如何映射到 HyperFrames 组合运行时
> （`data-*` 属性、CSS 类、timeline、track、sub-composition 等）。

### 顶层字段

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `compositionId` | `data-composition-id` 属性 + `window.__timelines["<id>"]` key | 三者必须一致。modular 架构下每个子组合文件也需遵照 |
| `width` | `data-width` （composition root 属性） | 渲染帧宽度 |
| `height` | `data-height` （composition root 属性） | 渲染帧高度 |
| `duration` | `data-duration` （composition root 属性） | 总时长；应 ≥ 场景时长之和 |
| `fps` | `data-fps` | 帧率，默认 30 |
| `title` | 元数据（页面 `<title>`） | 仅用于文档和预览 |
| `language` | `<html lang="…">` | 默认 `zh-CN` |

### 色板（palette）

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `palette.background` | `--background` CSS 变量 + `#root` background-color | 根背景色 |
| `palette.foreground` | `--foreground` CSS 变量 | 文本前景色 |
| `palette.accent` | `--accent` CSS 变量 | 强调色 |
| `palette.neutral` | `--neutral-0` ~ `--neutral-7` CSS 变量 | 中性色阶梯 |
| `palette.themeRef` | 引用 house-style 预设 | 预设提供默认值，JSON 显式值覆盖 |

### 排版（typography）

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `typography.headlineFont` | 主标题 `font-family` | 从预置 18 族中选择 |
| `typography.headlineWeight` | 主标题 `font-weight` | 默认 "900" |
| `typography.bodyFont` | 正文 `font-family` | 必须与 headlineFont 跨族系配对 |
| `typography.bodyWeight` | 正文 `font-weight` | 默认 "400" |
| `typography.monoFont` | 等宽文字 `font-family` | 代码/数字/统计用 |
| `typography.headlineSizeMin` | 显示字号最小值 | 全屏场景。In-feed ×1.5 |
| `typography.bodySizeMin` | 正文最小值 | 同上 |
| `typography.letterSpacing` | `letter-spacing`（em） | 显示字号收紧 |

### 动画默认值

| JSON 字段 | GSAP 映射 | 说明 |
|---|---|---|
| `animationDefaults.duration` | `gsap.defaults({ duration })` | 默认 0.6s |
| `animationDefaults.ease` | `gsap.defaults({ ease })` | 默认 `power3.out` |
| `animationDefaults.overwrite` | `gsap.defaults({ overwrite })` | 默认 `"auto"` |
| `animationDefaults.immediateRender` | `gsap.defaults({ immediateRender })` | 默认 `true` |

### 过渡

| JSON 字段 | 实现机制 | 说明 |
|---|---|---|
| `transitions.default.type` | 下一场景 clip 提前插入（`start - overlap`）+ 不同 track | 过渡 = 两 clip 重叠驱动 |
| `transitions.default.preset` | 预定义 duration/ease 组合 | 见预设速查表 |
| `transitions.byScene.<id>` | 按场景覆盖默认过渡 | 键为 scene.id |
| 过渡 duration | 两场景 clip 重叠时长 | 下一场景的 `start` 提前 overlap 秒 |
| 过渡 ease | 出/入场动画的 easing | 统一用于两方向 |

**禁止先退场再入场模式**（跳切 dip）。过渡由两场景 clip 重叠 + 时间线同时驱动出/入场实现。

### 变量

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `variables.declarations[].id` | 变量名（用作 `var-*` 后缀） | 必填 |
| `variables.declarations[].type` | 类型约束 | `string`/`color`/`number`/`boolean`/`enum`/`image`/`file` |
| `variables.declarations[].default` | 变量默认值 | 渲染时被 values 覆盖 |
| `variables.values` | `data-variable-values`（JSON 字符串） | 渲染时覆盖 declarations default |
| 元素 `varBindings` | `data-var-text` / `data-var-src` 等属性 | 绑定元素到变量 |

### 共享背景层

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `background.id` | `<div id="<id>">` | 非 clip — 无 `data-start`/`data-duration`/`data-track-index` |
| `background.style` | 内联 style | 全片可见 |
| `background.animations[].to` | `tl.to("#<id>", { … }, at)` | 驱动背景状态变化 |
| `background.animations[].at` | timeline 位置点 | 绝对秒 |

### 场景（scene = clip）

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `scene.id` | `<section id="<id>" class="clip">` | 唯一全局 id |
| `scene.start` | `data-start` | 绝对秒或相对引用。引用解析在生成器 |
| `scene.duration` | `data-duration` | 秒 |
| `scene.trackIndex` | `data-track-index` | 默认 1。track 0 保留给 composition root |
| `scene.background` | 元素内联 style | `null` = 透明（共享背景透出） |
| `scene.zIndex` | CSS `z-index` | 视觉层级 |
| `scene.transitionIn` | 过渡配置 | 覆盖 `transitions.byScene` 或 `transitions.default` |
| `scene.layoutAudit` | `data-layout-*` 属性 | 见 layoutAudit 表 |

**Clip 必须是 composition root 的直接子元素**。如需 wrapper 放在 clip 内部。

### 元素（公共字段）

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `element.id` | `id` 属性 | 场景内唯一（modular 下前缀 sceneId-） |
| `element.style` | 元素内联 style | camelCase。**禁止 transform** |
| `element.layoutAudit` | `data-layout-*` 属性 | 见 layoutAudit 表 |
| `element.varBindings` | `data-var-*` 属性 | 键是 `varText`, `varSrc`, `varHref`, `varAlt` |
| `element.animations` | `tl.to/from/fromTo` 调用 | 数组，每个一项 tween |
| `element.hidden` | `data-hidden` 属性 | 预览+渲染均隐藏，可逆 |

### 元素类型

#### text

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `content` | 元素 innerText | 禁止 `<br>` |
| `typography` | 部分覆盖全局排版 | 字体/字号/字重/颜色/对齐等 |
| `textEffect` | 文本动画预设 | 命名预设或原始透传 |

#### image

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `src` | `<img src>` | 路径 |
| `fit` | `object-fit` | 默认 `cover` |
| `radius` | `border-radius` | px |
| `fallbackSrc` | `onerror` 回退 | varSrc 绑定时必填 |

#### shape

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `kind` | CSS 样式（`border-radius: 50%` 等） | `rect`/`circle`/`ellipse`/`line` |
| `backgroundColor` | `background-color` | 颜色值 |
| `border` | `border` 简写 | 宽度/颜色/样式 |
| `radius` | `border-radius` | 仅 rect/ellipse |

#### video

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `src` | `<video src>` | 路径 |
| `mediaStart` | `data-media-start` | 偏移秒 |
| `volume` | `data-volume` | 静态基线 |
| `hasAudio` | `data-has-audio` | 必须有独立 `<audio>` 元素 |
| `crossOrigin` | `crossorigin` | 选填 |

生成器自动加 `muted playsinline`。**不需要 `class="clip"`**（框架直接管理可见性）。

#### audio

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `src` | `<audio src>` | 即使 src 与 video 相同也要独立元素 |
| `volume` | `data-volume` | 静态基线 |
| `mediaStart` | `data-media-start` | 偏移秒 |

#### group

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `layout` | CSS `display` + `position` | `absolute`/`flex`/`grid` |
| `direction` | `flex-direction` | 仅 flex 布局 |
| `gap` | `gap` | px |
| `align` | `align-items` | — |
| `justify` | `justify-content` | — |
| `padding` | `padding` | px |
| `children` | 子元素数组 | 可递归嵌套 group |

group 本身不参与动画。动画目标其子元素或内部 wrapper。

#### icon

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `kind` | registry/catalog 名称或 SVG path | v1 可选 |
| `size` | `width` + `height` | px |
| `color` | `fill` 或 `color` | 颜色值 |

### 音频轨道

| JSON 字段 | HyperFrames 映射 | 说明 |
|---|---|---|
| `audioTracks[].id` | `<audio id="<id>">` | 独立元素 |
| `audioTracks[].src` | `src` 属性 | 路径 |
| `audioTracks[].start` | `data-start` | 绝对秒 |
| `audioTracks[].duration` | `data-duration` | 可省略 = 媒体全长 |
| `audioTracks[].trackIndex` | `data-track-index` | 默认 10（远离视觉 track） |
| `audioTracks[].volume` | `data-volume` | 静态基线 |
| `audioTracks[].fades[].at` | `tl.to("#<id>", { volume: to }, at)` | 时间线上的 volume 动画 |

### layoutAudit 属性

| JSON 字段 | `data-*` 属性 | 说明 |
|---|---|---|
| `allowOverflow` | `data-layout-allow-overflow` | 允许内容溢出 |
| `bleed` | `data-layout-bleed` | 出血预留 |
| `ignore` | `data-layout-ignore` | 跳过布局检查 |
| `allowCaptionZone` | `data-layout-allow-caption-zone` | 允许字幕区域 |

---

## 架构：monolithic vs modular

### Monolithic（默认）

```
index.html
├── <style>/* 全部样式 */
├── <section class="clip" id="hook" data-start="0" data-duration="4" data-track-index="1">
│   └── 元素
├── <section class="clip" id="feature" data-start="3.8" data-duration="4.5" data-track-index="2">
│   └── 元素
└── <script>
    const tl = gsap.timeline({ paused: true });
    tl.to("#hook-title", { opacity: 1, duration: 1 });
    // ... 全部动画在一条 timeline 上
    window.__timelines["main"] = tl;
    </script>
```

### Modular（architecture: "modular"）

```
index.html（薄编排器）
├── <style>/* 全局样式 */
├── <div data-composition-src="compositions/hook.html"></div>
├── <div data-composition-src="compositions/feature.html"></div>
└── <script>
    // 近空 root timeline（仅全局 bg/audio fade）
    // 场景 timeline 从子组合文件加载
    </script>

compositions/hook.html
├── <template>
│   ├── <style>
│   ├── <section class="clip" id="hook" data-start="0" data-duration="4" data-track-index="1">
│   │   └── 元素
│   └── <script>
│       const tl = gsap.timeline({ paused: true });
│       // 场景动画
│       window.__timelines["hook"] = tl;
│       </script>
</template>
```

### 3 条 Sub-composition Pitfall 规则

| # | 规则 | 违反后果 |
|---|---|---|
| 1 | `<style>`/`<script>`/`markup` 全部放在 `<template>` **内部** | runtime 只 clone template 内容；外部内容丢失 |
| 2 | Host slot `data-composition-id` == 文件内部 `data-composition-id` == `window.__timelines["<id>"]` key | 三者必须完全一致，否则 timeline 找不到 |
| 3 | Root 元素样式用 `#root` 选择器（不能用 class 选择器） | CSS scoping 会把 `.class` 变成 `[data-composition-id] .class` 导致无法匹配 root 自身 |
| 4 | 内部元素 id 前缀 `<sceneId>-` | 防止跨文件 id 冲突 |

---

## 预置 18 字体族

> 零网络请求预置。推荐组合标记 ✓（跨族系配对）、⚠（慎用）、✗（禁用）。

### 预置 San Serif 族

| 名称 | 推荐组合 | 说明 |
|---|---|---|
| Montserrat | ✓ 与 EB Garamond/Bodoni Moda 等 | 几何无衬线 ⭐ 推荐 |
| Oswald | ✓ 与 Playfair Display/Cinzel | 窄体显示字 |
| League Gothic | ✓ 与 EB Garamond | 紧凑压缩字 |
| Archivo Black | ✓ 与 EB Garamond | 极粗黑体 |
| Inter | ✗ 禁用 | 过度使用，无视觉冲击 |

### 预置 Mono 族

| 名称 | 推荐组合 | 说明 |
|---|---|---|
| Space Mono | ✓ 与 Montserrat | 等宽显示字 |
| IBM Plex Mono | ✓ 与 Montserrat | 等宽体 |
| JetBrains Mono | ✓ 推荐 | 代码连字 |
| Source Code Pro | ✓ 与 Montserrat | 经典等宽 |

### 预置 Serif 族

| 名称 | 推荐组合 | 说明 |
|---|---|---|
| EB Garamond | ✓ 推荐 | 不推荐用于正文正文（视频过细） |
| Playfair Display | ✓ 默认 | 推荐搭配 Montserrat |
| Bodoni Moda | ✓ 与 Montserrat | 现代衬线 |
| Cinzel | ✓ 与 Oswald | 罗马大写体 |
| Prata | ✓ 与 Montserrat | 过渡衬线 |
| Syne | ✓ 与 Montserrat | 可变衬线 |

### 预置 CJK 族

| 名称 | 推荐组合 | 说明 |
|---|---|---|
| Noto Sans JP | ✓ 与 Montserrat | 日文。中文可接受 |
| Noto Sans SC | ✓ 推荐 | 简体中文正文 |

### 禁用列表

| 字体 | 原因 |
|---|---|
| Inter | 过度使用，无视觉冲击 |
| Roboto | Android 默认，无个性 |
| Open Sans | 过度使用 |
| Lato | 过度使用 |
| Nunito | 圆体过于友好 |
| Poppins | 过度使用 |
| Outfit | 过度使用 |
| Sora | 弱对比 |
| Playfair Display* | 仅用于正文段落，视频中偏细 |
| Cormier Garamond | 视频中过细 |
| Bodoni Moda* | 仅用于标题，偏细 |
| EB Garamond* | 仅用于正文段落，视频中过细 |
| Cinzel* | 仅用于标题，正文不可读 |
| Prata* | 仅用于标题 |

> * 这些字体标注为"禁用"指视频正文场景；标题场景可根据需要选用。

### 推荐配对

| 标题 | 正文 | 场景 |
|---|---|---|
| Montserrat 900 | EB Garamond 400 | ⭐ 通用推荐 |
| Oswald 700 | Playfair Display 400 | 现代/科技感 |
| League Gothic 800 | EB Garamond 400 | 紧凑冲击 |
| Archivo Black 900 | Noto Sans SC 400 | 中文场景 |
| Space Mono 700 | EB Garamond 400 | 科技/代码风 |

---

## 过渡目录速查表

### Push/Slide 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `push-slide` | 水平推滑 | 章节切换 |
| `vertical-push` | 垂直推滑 | 纵深叙事 |
| `elastic-push` | 弹性推滑 | 活泼品牌 |
| `squeeze` | 挤压过渡 | 紧凑节奏 |

### Zoom 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `zoom-through` | 缩放穿过 | 冲击性入场 |
| `zoom-out` | 缩放退出 | 揭示全貌 |
| `gravity-drop` | 重力下落 | 产品展示 |

### Reveal 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `circle-iris` | 圆形展开 | 聚焦/揭示 |
| `diamond-iris` | 菱形展开 | 高端/精致 |
| `diagonal-split` | 对角线分割 | 对比/并列 |
| `clock-wipe` | 时钟擦除 | 计时/进度 |
| `shutter` | 百叶窗 | 节奏切割 |

### Dissolve 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `crossfade` | 交叉淡入淡出 | ⭐ 通用默认 |
| `blur-crossfade` | 模糊交叉淡入淡出 | 柔和过渡 |
| `focus-pull` | 焦点拉远 | 深度层次 |
| `color-dip-black` | 黑色闪入闪出 | 强停顿 |

### Pattern 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `staggered-blocks` | 交错方块 | 现代/动态 |
| `horizontal-blinds` | 水平百叶板 | 分割/重组 |
| `vertical-blends` | 垂直混合 | 并列/对比 |

### Effect 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `light-leak` | 漏光 | 怀旧/电影感 |
| `overexposure-burn` | 过曝 | 闪回/梦境 |
| `film-burn` | 胶片灼烧 | 复古/粗粝 |

### Distortion 类

| 类型 | 效果 | 适用场景 |
|---|---|---|
| `glitch` | 故障效果 | 科技/错误 |
| `chromatic-aberration` | 色差 | 故障/科技 |
| `ripple` | 波纹 | 水/反射 |
| `vhs-tape` | VHS 磁带 | 复古/低保真 |

### Preset 参数

| preset | duration | ease | 适用场景 |
|---|---|---|---|
| snappy | 0.2s | power4.inOut | 快速节奏 |
| **smooth** | **0.4s** | **power2.inOut** | ⭐ 通用默认 |
| gentle | 0.6s | sine.inOut | 柔和/纪录片 |
| dramatic | 0.5s | power3.in → out | 冲击/高潮 |
| instant | 0.15s | expo.inOut | 闪切 |
| luxe | 0.7s | power1.inOut | 高端/慢节奏 |

---

## 确定性规则摘要

### 安全性

| # | 规则 | 校验 |
|---|---|---|
| 1 | 禁止 `repeat: -1` | Schema `minimum: 0` |
| 2 | 动画属性限白名单 | `animatableProperty` enum |
| 3 | style 禁止 `transform` | `camelCaseStyle` patternProperties |
| 4 | 禁止 `visibility`/`display` 动画 | 同上 |
| 5 | 禁止 `display`/`visibility` 在 style 中 | 同上 |

### 时序

| # | 规则 | 校验 |
|---|---|---|
| 6 | 同 track clip 不可重叠 | 区间排序检查 |
| 7 | 最后一个场景允许退场动画 | 其余场景退场由过渡表达 |
| 8 | 过渡不能先退场再入场 | 两 clip 重叠实现 |

### 结构

| # | 规则 | 校验 |
|---|---|---|
| 9 | Clip 必须是 composition root 的直接子元素 | 生成器固定 |
| 10 | root 有 `data-start="0"` | 生成器固定 |
| 11 | 单条 paused timeline 注册在 `window.__timelines[...]` | 生成器固定 |
| 12 | 同源音频必须用独立 `<audio>` 元素 | 结构化校验 |
| 13 | video 自动 `muted playsinline` | 生成器固定 |

### 变量

| # | 规则 | 校验 |
|---|---|---|
| 14 | values 键必须在 declarations 中存在 | 代码校验器 |
| 15 | values 类型必须匹配 declaration | 代码校验器 |
| 16 | enum 值必须在 options 内 | 代码校验器 |

### 排版

| # | 规则 | 校验 |
|---|---|---|
| 17 | headline ≥ 700 vs body ≤ 400 | 视频需极端反差 |
| 18 | 标题与正文必须跨族系配对 | 文档建议，非强制 |
| 19 | 文本颜色与背景色 ≈ WCAG AA | 对比度算法 |

---

## Stagger 形状参考

| 形状 | 描述 | 配置 |
|---|---|---|
| 线性 | 逐个元素序列 | `{ "stagger": 0.1 }` |
| 从中心 | 从中间向两边 | `{ "stagger": { "from": "center", "each": 0.05 } }` |
| 从边缘 | 从两边向中间 | `{ "stagger": { "from": "edges", "each": 0.05 } }` |
| 随机 | 随机顺序 | `{ "stagger": { "from": "random", "each": 0.1 } }` |
| 网格行 | 先行后列 | `{ "stagger": { "grid": "auto", "axis": "x" } }` |
| 网格列 | 先列后行 | `{ "stagger": { "grid": "auto", "axis": "y" } }` |

---

## Ease 名称表

### 命名 Power Ease

| 名称 | GSAP 映射 | 曲线说明 |
|---|---|---|
| `power1.out` | `power1.out` | 轻微缓出 |
| `power2.out` | `power2.out` | 适中缓出 |
| `power3.out` | `power3.out` | ⭐ 默认，强烈缓出 |
| `power4.out` | `power4.out` | 极强缓出 |
| `power1.inOut` | `power1.inOut` | 轻微缓入缓出 |
| `power2.inOut` | `power2.inOut` | 适中缓入缓出，过渡默认 |
| `power3.inOut` | `power3.inOut` | 强烈缓入缓出 |
| `power4.inOut` | `power4.inOut` | 极强缓入缓出 |
| `power1.in` | `power1.in` | 轻微缓入 |
| `power2.in` | `power2.in` | 适中缓入 |
| `power3.in` | `power3.in` | 强烈缓入 |
| `power4.in` | `power4.in` | 极强缓入 |

### 特殊 Ease

| 名称 | GSAP 映射 | 说明 |
|---|---|---|
| `back.out(N)` | `back.out(N)` | 弹性超出，N=1.7 默认 |
| `elastic.out(N, P)` | `elastic.out(N, P)` | 弹性振荡 |
| `bounce.out` | `bounce.out` | 弹跳 |
| `steps(N)` | `steps(N)` | 逐帧动画 |
| `sine.inOut` | `sine.inOut` | 正弦缓入缓出（柔和） |
| `circ.inOut` | `circ.inOut` | 圆形缓入缓出 |
| `expo.out` | `expo.out` | 指数缓出（快速开始） |
| `expo.inOut` | `expo.inOut` | 指数缓入缓出 |
| `none` | `none` | 线性（无缓动） |
| CSS 贝塞尔 | `M0,0 C0.25,0.1 0.25,1 1,1` | 自定义曲线 |