# JSON2Hyperframes 

[English](README.md) | [简体中文](README_zh.md)

将 JSON 视频配置转换为 [HyperFrames](https://hyperframes.heygen.com) HTML 组合项目，并将其渲染为 MP4 视频。

## 为什么有这个仓库?

1. **AI 时代的接口 (LLM-Friendly)**:
   让 LLM 直接写出几百行复杂的 Hyperframes HTML + GSAP 动效，幻觉率极高，几乎不可控。但让 LLM 输出一段符合 Schema 的 `video-config.json`（定义好场景、文字、配色、角色）极其简单和稳定。本项目是 AI 自动生成视频 (AIGC Video Pipeline) 的核心组件。

2. **批量化生产 (Automation)**:
   比如商家要为 10,000 个商品自动生成 10,000 个带商品图和价格的短视频。他们不可能去写 10,000 个 HTML，但可以轻易用数据库数据渲染出 10,000 个 JSON，然后调用本 CLI 批量生成并渲染。

## CLI 命令行用法

```bash
# 全局安装
npm install -g j2hf

# 创建一个新项目
j2hf init my-video
cd my-video

# 从 video-config.json 生成 HyperFrames HTML
j2hf generate

# 在浏览器中预览
j2hf preview

# 渲染为 MP4 视频
j2hf render
```

或者无需安装直接使用 `npx` 运行：

```bash
npx j2hf init my-video
cd my-video
npx j2hf generate
npx j2hf preview
```

## 命令列表

| 命令 | 说明 |
|---|---|
| `j2hf init [projectName]` | 创建新项目（支持交互式输入或行内指定名称） |
| `j2hf generate [--config=PATH]` | 生成 HyperFrames HTML（支持 monolithic 或 modular 架构） |
| `j2hf preview [--force-new]` | 启动预览服务器 |
| `j2hf render [--output=FILE]` | 渲染 MP4，默认保存到 `videos/` 目录下 |

## 项目架构

- **Monolithic（单体架构）**（默认）：生成单个 `output/index.html`，其中包含所有场景和一条 GSAP 时间线。
- **Modular（模块化架构）**：生成一个薄宿主 `index.html`，并在 `output/compositions/` 目录下为每个场景生成独立的子组合 `.html` 文件。

在 `video-config.json` 中设置 `"architecture": "modular"`，并提供 `subCompositions.scenes` 数组即可启用模块化。

## 配置

编辑 `video-config.json` 来定义场景、元素、动画、色板、变量及音频音轨。

校验 Schema 文件路径为：`schemas/video-config.schema.json`

## 本地开发调试（本仓库）

```bash
npm install
node bin/j2hf.mjs init demo
node bin/j2hf.mjs generate --config=demo/video-config.json
```

## 开源协议

ISC
