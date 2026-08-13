# __PROJECT__ 

[English](README.md) | [简体中文](README_zh.md)

> 由 `j2hf init` 自动生成的 JSON2Hyperframes 视频项目

## 快速开始

```bash
# 1. 从 video-config.json 生成 HyperFrames HTML 文件
j2hf generate

# 2. 在浏览器中打开并实时预览
j2hf preview

# 3. 渲染输出为 MP4 视频
j2hf render
```

## 项目结构

```
__PROJECT__/
├── video-config.json    编辑此文件以构建你的视频
│                       JSON schema 校验文件: schemas/video-config.schema.json
├── output/              生成的 HyperFrames HTML (index.html)
├── videos/              渲染输出的 MP4 视频目录
└── README.md
```

## 配置项

通过编辑 `video-config.json` 来配置以下属性：

- **组合属性 (Composition)**：分辨率、帧率 (fps)、总时长、调色板
- **场景 (Scenes)**：每个场景包含的元素类型（如：文本 `text`、图片 `image`、形状 `shape`、视频 `video`、组 `group`、图标 `icon`）
- **动画 (Animations)**：基于 GSAP 的每个元素的过渡动画（from/to/fromTo）
- **架构 (Architecture)**：`monolithic`（单文件架构）或 `modular`（嵌套子组合架构）

## 命令列表

| 命令 | 说明 |
|---|---|
| `j2hf generate` | 读取配置并将生成的 HyperFrames HTML 写入到 `output/` |
| `j2hf preview` | 对 `output/` 下的 HTML 启动本地预览服务器 |
| `j2hf render` | 通过 hyperframes 渲染为 MP4 视频，保存到 `videos/` |
| `j2hf init <name>` | 创建一个新项目 |
| `j2hf generate --config=path.json` | 使用自定义的配置文件路径进行转换 |

## 静态资源

将媒体资源（图片、视频、音频等）放置在项目根目录或子目录下。
并在 `video-config.json` 中使用相对路径进行引用。
