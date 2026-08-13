# JSON2Hyperframes 校验不变量清单

> 本清单定义 `scripts/validate.mjs` 需要实现的跨字段校验规则。
> 每条不变量包含：校验方法、伪代码/算法描述、错误信息格式。

---

## 不变量 1：ID 全局唯一

**校验方式**：O(n) 去重检查

```
算法：
  1. 收集所有场景 id（scenes[].id）
  2. 收集所有元素 id（scenes[].elements[].id，递归遍历 group.children）
  3. 收集根级 id（background.id, audioTracks[].id）
  4. 检查上述集合是否有重复
  5. modular 架构下：子组合内部元素 id 前缀 = sceneId（需检查前缀匹配）
```

**错误信息**：
```
[E001] Duplicate ID found: "hero-title" appears in scenes "hook" and "feature"
```

---

## 不变量 2：同 track 上 clip 时间窗不可重叠

**校验方式**：区间排序检查

```
算法：
  1. 按 trackIndex 分组场景
  2. 解析所有 start 引用为绝对秒（见不变量 3）
  3. 每组内按 start 升序排序场景
  4. 对每个相邻对 (prev, next)：
     - 如果 prev.start + prev.duration > next.start → 重叠
  5. 注意：不同 trackIndex 上的 clip 允许重叠（这是正常的多轨道行为）
```

**错误信息**：
```
[E002] Track overlap on track 1: scene "s1" [0, 4) overlaps with scene "s2" [2, 6)
```

---

## 不变量 3：start 引用可解析、无环、被引用 clip 有已知 duration

**校验方式**：图遍历

```
算法：
  1. 构建场景 ID → 场景的映射
  2. 对每个场景的 start：
     a. 数字 → 直接使用
     b. 字符串 → 解析引用模式：
        - "<id>" → 查找被引用场景，获取其 start + duration
        - "<id> + N" → 同上，加偏移
        - "<id> - N" → 同上，减偏移
     c. 被引用场景必须在映射中（否则未定义引用）
     d. 被引用场景必须已经有已知 start（resolve 顺序）
  3. 环检测：DFS 追踪 visited 集合
     - 如果 A 引用 B，B 引用 A → 循环
     - 如果 A 引用 B，B 引用 C，C 引用 A → 循环
  4. 被引用场景必须有 > 0 的 duration（否则位置未定义）
```

**错误信息**：
```
[E003] Unresolved reference: scene "s3" references "s4" which is not defined
[E003] Circular reference detected: s1 → s2 → s1
[E003] Referenced scene "s2" has zero duration, cannot compute start for "s3"
```

---

## 不变量 4：场景时长之和 ≤ root duration

**校验方式**：数值求和

```
算法：
  1. 计算所有场景的 max_end = max(scene.start + scene.duration)
  2. 如果 root.duration 存在：
     - 如果 max_end > root.duration → 超出
     - 允许 max_end < root.duration（尾部留空/last scene exit animation）
  3. 如果 root.duration 不存在，自动设为 max_end（生成器）
```

**错误信息**：
```
[E004] Scene total exceeds root duration: scenes end at 9.5s, but root duration is 8s
```

---

## 不变量 5：动画属性 ∈ 白名单

**校验方式**：Schema + 白名单校验

```
白名单（可动画的属性）：
  opacity, x, y, scale, scaleX, scaleY, rotation,
  skewX, skewY, transformOrigin,
  color, backgroundColor, borderColor, borderRadius,
  width, height,
  padding, margin,
  --css-var, volume, innerText

算法：
  1. 遍历所有元素的 animations 数组
  2. 对每个 tween：
     a. 检查 from 和 to 中的所有属性键是否在白名单中
     b. 如果不在 → 错误
     c. 检查 repeat 是否为 -1 → 错误（Schema 已做 minimum: 0，但代码校验器需二次确认）
     d. 检查 repeat 是否为负数（非 -1 的负数）→ 错误
  3. 遍历所有元素的 style：
     a. 检查是否有 transform 键 → 错误
     b. Schema 已做，但代码校验器需二次确认（防止 Schema 绕过）
```

**错误信息**：
```
[E005] Forbidden animation property "width" in scene "s1", element "hero-title"
[E005] repeat: -1 is forbidden in scene "s3", element "badge" (use repeat: 0 for no repeat)
[E005] Style must not contain "transform" (scene "s2", element "logo"). Use GSAP x/y/scale/rotation instead.
```

---

## 不变量 6：media src 文件路径存在

**校验方式**：filesystem check

```
算法：
  1. 收集所有 media src 路径：
     - 元素类型为 image/video/audio 的 src
     - audioTracks 的 src
  2. 对每个路径，检查文件是否存在（fs.existsSync）
  3. 路径相对于项目根目录解析
  4. 如果路径以 http:// 或 https:// 开头，跳过（远程资源）
  5. 警告但非致命（允许渲染时动态加载）
```

**错误信息**：
```
[E006] Media file not found: "assets/bgm.mp3" (scene "bgm", element "audio-track")
[W006] Media file not found: "assets/hero.jpg" — will fail at render time
```

---

## 不变量 7：video 自动 muted+playsinline；同源音频独立

**校验方式**：结构化校验

```
算法：
  1. 对每个 video 元素：
     a. 生成器自动添加 muted + playsinline 属性（不变量，不是校验）
     b. 不要求用户显式写出
  2. 对每个 video 元素且有 hasAudio: true：
     a. 检查是否有独立 audio 元素（或 audioTracks）对应同一 src
     b. 如果没有 → 警告（音频可能丢失）
  3. 如果 video 有 volume 动画但 hasAudio: false → 错误（无音频可控制）
```

**错误信息**：
```
[E007] Scene "s2" video "demo" has hasAudio: true but no separate audio element for "assets/demo.mp4"
[E007] Scene "s1" video "bg-clip" has volume animation but hasAudio: false
```

---

## 不变量 8：过渡 type ∈ 目录枚举；ease ∈ 命名表

**校验方式**：enum 校验

```
过渡类型枚举（见 docs/schema.md 过渡目录速查表）：
  push-slide, vertical-push, elastic-push, squeeze,
  zoom-through, zoom-out, gravity-drop,
  circle-iris, diamond-iris, diagonal-split, clock-wipe, shutter,
  crossfade, blur-crossfade, focus-pull, color-dip-black,
  staggered-blocks, horizontal-blinds, vertical-blends,
  light-leak, overexposure-burn, film-burn,
  glitch, chromatic-aberration, ripple, vhs-tape,
  grid-dissolve

Ease 命名表（见 docs/schema.md Ease 名称表）：
  power[1-4].(out|in|inOut), back.out, elastic.out, bounce.out,
  steps(N), sine.inOut, circ.inOut, expo.out, expo.inOut, none,
  M0,0 C... (CSS bezier)

算法：
  1. 收集所有 transition 配置：
     a. transitions.default
     b. transitions.byScene 中的所有值
     c. 每个场景的 scene.transitionIn
  2. 检查 type 是否在枚举中
  3. 如果提供了 ease 且不是 CSS 贝塞尔曲线：
     a. 检查 ease 是否在命名表中
     b. CSS 贝塞尔（M0,0...）允许自定义（至少匹配基本格式）
  4. 如果提供了 preset，检查是否在预设枚举中
  5. 如果同时提供了 duration/ease 和 preset → 警告（priority 明确：duration/ease 覆盖 preset）
```

**错误信息**：
```
[E008] Unknown transition type: "warp-speed" in scene "feature"
[E008] Unknown ease name: "nonexistent-ease" in scene "s1" transition
```

---

## 不变量 9：文本颜色与背景色对比度 ≈ WCAG AA

**校验方式**：对比度算法

```
算法：
  1. 对每个 text 元素，获取其 color 和其所在场景的 background
     （如果场景 background 为 null，使用 palette.background）
  2. 计算相对亮度：
     L = 0.2126 * R + 0.7152 * G + 0.0722 * B
     其中 R/G/B 是 sRGB 到线性空间的转换后的值
  3. 计算对比度：
     contrast = (L1 + 0.05) / (L2 + 0.05)  // L1 为较亮色
  4. 如果 contrast < 3.0 → 错误（WCAG AA 正常文本要求 4.5:1，大文本 3:1）
  5. 注意：仅近似计算。精确的 WCAG 计算需要解析颜色字符串
```

**错误信息**：
```
[W009] Low contrast ratio: text color "#666666" on background "#0b0f14" = 2.3:1 (WCAG AA requires ≥ 3:1 for large text)
```

---

## 不变量 10：visual clip 必有 class="clip"

**校验方式**：生成器固定（非校验器）

```
说明：
  生成器在输出 HTML 时，每个 <section> 元素自动添加 class="clip"。
  这不是校验器检查的内容，而是生成器的固定输出契约。
```

---

## 不变量 11：root 有 data-start="0"

**校验方式**：生成器固定（非校验器）

```
说明：
  生成器在输出 HTML 时，composition root 的 <div> 自动添加 data-start="0"。
  这不是校验器检查的内容，而是生成器的固定输出契约。
```

---

## 不变量 12：单条 paused timeline 注册在 `window.__timelines[compositionId]`

**校验方式**：生成器固定（非校验器）

```
说明：
  生成器输出确保：
  1. 一条 gsap.timeline({ paused: true })
  2. 所有动画附加到该 timeline
  3. 注册在 window.__timelines["<compositionId>"]
  4. compositionId 与 JSON 中一致
  这不是校验器检查的内容，而是生成器的固定输出契约。
```

---

## 不变量 13：values 键必须在 declarations 中存在

**校验方式**：集合比较

```
算法：
  1. 收集所有 declarations[].id → Set
  2. 收集所有 values 的键 → Set
  3. 检查 values 键是否都是 declarations 的子集
  4. 如果 values 中有不在 declarations 中的键 → 错误
```

**错误信息**：
```
[E013] Undeclared variable value: "unknownKey" is not in declarations (declared: title, accent, count, showCta)
```

---

## 不变量 14：values 类型必须匹配 declaration

**校验方式**：类型检查

```
算法：
  1. 对每个 values 键，找到对应的 declaration
  2. 根据 declaration.type 检查 values 值的类型：
     - string → 必须是字符串
     - color → 必须是字符串，匹配 #hex/rgb()/hsl() 格式
     - number → 必须是数字
     - boolean → 必须是布尔值
     - enum → 值必须在 options[].value 列表中
     - image/file → 必须是字符串
  3. 如果类型不匹配 → 错误
  4. 如果 number 类型有 min/max 约束 → 检查范围
```

**错误信息**：
```
[E014] Variable "count" expects number, got string "one hundred thousand"
[E014] Variable "tone" has value "c" but enum options are: a, b
```

---

## 不变量 15：enum 值必须在 options 内

**校验方式**：集合检查

```
算法：
  1. 对每个 type=enum 的 declaration，收集 options[].value → Set
  2. 如果 values 中有对应的值 → 检查是否在 Set 中
  3. 如果不在 → 错误
  4. 检查 default 是否也在 options 内（Schema 已做，但需二次确认）
```

**错误信息**：
```
[E015] Variable "tone" has value "c" but valid options are: ["a", "b"]
```

---

## 不变量 16：transition 同时提供 duration/ease 和 preset

**校验方式**：Schema 依赖条件（代码校验器需二次确认）

```
算法：
  1. 对每个 transition 配置，检查是否同时有 duration/ease 和 preset
  2. 如果同时存在 → 警告（Schema 已禁止，但代码校验器覆盖）
  3. 优先级：duration/ease 覆盖 preset
```

**错误信息**：
```
[W016] Transition in scene "s2" has both preset and duration/ease — preset will be ignored
```

---

## 不变量 17：modular 架构下 subCompositions 必填

**校验方式**：条件必填

```
算法：
  1. 如果 architecture === "modular"
  2. 检查 subCompositions 是否存在
  3. 如果不存在 → 错误
  4. 检查 subCompositions.scenes 中的 sceneId 是否在 scenes 中
  5. 如果不在 → 错误
```

**错误信息**：
```
[E017] architecture is "modular" but subCompositions is missing
[E017] subComposition references scene "unknown" which is not defined in scenes array
```

---

## 不变量 18：标题与正文字体跨族系配对

**校验方式**：文档建议（非强制错误）

```
算法：
  1. 检查 typography.headlineFont 和 typography.bodyFont
  2. 根据预置族系分类（sans/serif/mono/CJK）判断是否跨族系
  3. 如果在同一族系内 → 警告（非强制）
  4. 如果都在禁用列表 → 错误
```

**族系分类**：
- Sans: Montserrat, Oswald, League Gothic, Archivo Black, Inter(禁用), Roboto(禁用)
- Serif: EB Garamond, Playfair Display, Bodoni Moda, Cinzel, Prata, Syne
- Mono: Space Mono, IBM Plex Mono, JetBrains Mono, Source Code Pro
- CJK: Noto Sans JP, Noto Sans SC

**错误信息**：
```
[W018] Body font "Montserrat" is in the same family (sans) as headline font "Oswald" — consider a serif body font for contrast
[E018] Font "Inter" is in the disabled list — consider Montserrat or League Gothic
```

---

## 校验器实现说明

### 优先级

不变量校验器应分三层执行：

1. **Schema 层**（ajv / JSON Schema）：覆盖简单类型、格式、必填检查
2. **代码校验器**（scripts/validate.mjs）：覆盖跨字段、状态ful、文件系统检查
3. **生成器固定**（不变规则由生成器保证，不校验）

### 校验器输出格式

```
校验器应输出 JSON 格式供 CI 消费 + 人类可读格式供终端：
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

### 错误严重性

| 级别 | 代码前缀 | 含义 |
|---|---|---|
| 致命 | E | 必须修复，生成器无法继续 |
| 警告 | W | 建议修复，不影响生成 |
| 信息 | I | 信息说明，无需操作 |

### 跳过规则

校验器支持 `--skip` 参数跳过特定不变量：
```
npx validate --config demo.json --skip E009,E018
```

### 伪代码入口

```javascript
function validate(config) {
  const errors = [];
  const warnings = [];
  const info = [];

  // 1. Schema 校验（ajv）
  const schemaValid = validateSchema(config);
  if (!schemaValid) { errors.push(...schemaErrors); }

  // 2. 解析场景 start 引用
  const scenes = resolveSceneStarts(config.scenes);

  // 3. 执行不变量
  invariant1(config, errors);  // ID 唯一
  invariant2(scenes, errors);  // Track 重叠
  invariant3(config, errors);  // Start 引用
  invariant4(config, scenes, errors);  // Duration
  invariant5(config, errors);  // 动画属性
  invariant6(config, warnings);  // Media 文件
  invariant7(config, warnings);  // Video audio
  invariant8(config, errors);  // 过渡类型
  invariant9(config, warnings);  // 对比度
  // I10-I12: 生成器固定
  invariant13(config, errors);  // Values 键
  invariant14(config, errors);  // Values 类型
  invariant15(config, errors);  // Enum 值
  invariant16(config, warnings);  // 过渡冲突
  invariant17(config, errors);  // Modular 完整性
  invariant18(config, warnings);  // 字体配对

  return { valid: errors.length === 0, errors, warnings, info };
}
```