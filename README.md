<div align="center">

<img src="web/public/logo.svg" width="88" alt="C-AI画布 logo">

# C-AI画布

**在一块无限画布上，生成、连接与重组你的视觉创意**

A unified canvas workspace for AI image creation — generate, connect, and remix.

<p>
  <img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
</p>

</div>

---

C-AI画布是一款面向图片创作的开源工作台。它把**画布编排、AI 图片生成、参考图编辑、对话助手、提示词库和素材沉淀**收纳在同一个界面里，适合用来探索视觉方案并连续迭代图片结果。

> [!CAUTION]
> 项目处于开发阶段，不保证历史数据兼容。数据库结构与存储格式可能直接调整，当前更适合个人 / 本地部署，不建议直接公网多人共用。

<br>

## 效果展示

<table width="100%">
  <tr>
    <td width="50%"><img src="https://i.ibb.co/TDFvGWDT/image.png" alt="效果展示" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/zVwJq3YS/image.png" alt="效果展示" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/PvY3qhhK/image.png" alt="效果展示" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/7D04LwN/image.png" alt="效果展示" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/bj30FtS5/5.png" alt="效果展示" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/hxRvjw51/image.png" alt="效果展示" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/jkWsF8q1/image.png" alt="效果展示" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/XrnfXHx7/image.png" alt="效果展示" border="0"></td>
  </tr>
</table>

<br>

## 核心功能

| 能力 | 说明 |
| :--- | :--- |
| **无限画布** | 多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出 |
| **AI 创作** | 默认前台直连 OpenAI 兼容接口，Docker 部署可切换同域 Go 代理；支持文生图、图生图、参考图编辑、文本问答、音视频生成 |
| **画布助手** | 围绕选中节点与上游节点对话、生图，并把结果插回画布 |
| **C-ai Agent** | 通过本机 C-ai Agent 连接 Codex / Claude Code，让 Agent 经 MCP 操作当前画布 |
| **提示词库** | 前端直拉多个 GitHub 开源项目的提示词，并缓存在浏览器本地 |

完整功能说明见 [功能介绍](docs/content/docs/overview/features.mdx)。

<br>

## 技术栈

<table>
  <tr>
    <td><b>前端</b></td>
    <td>Vite · React · React Router · TypeScript · Tailwind CSS · Ant Design · Zustand · TanStack Query</td>
  </tr>
  <tr>
    <td><b>运行形态</b></td>
    <td>Vite 静态前端；Docker 镜像内置可选 Go AI 请求代理；提示词和 WebDAV 由浏览器直连</td>
  </tr>
  <tr>
    <td><b>部署</b></td>
    <td>任意静态站点托管 · Docker / nginx + Go proxy</td>
  </tr>
</table>

<br>

## 快速开始

主应用已迁移为 Vite 静态前端构建。AI API Key、Base URL、画布、素材与生成记录默认保存在浏览器本地，可部署到任意静态站点托管；Docker 镜像额外内置同域 Go 代理，用于解决部分模型渠道不支持浏览器 CORS 的问题。

**本地开发**

```bash
git clone git@github.com:cangerx/c-aihuabu.git
cd c-aihuabu/web
bun install
bun run dev
```

**Docker 运行**

```bash
docker build -t c-aihuabu .
docker run --rm -p 3000:3000 c-aihuabu
```

启动后访问 `http://localhost:3000`，进入右上角配置，填入自己的 OpenAI 兼容 `Base URL` 与 `API Key` 即可开始创作。默认使用“浏览器直连”；如果渠道不支持 CORS，Docker 部署可在“生成偏好”里切换为“同域代理”。WebDAV 仍需要服务自身允许浏览器 CORS 请求。

<br>

## New API 自动配置

如果使用 New API，可在 `系统设置 → 聊天方式 → 添加聊天设置` 中填入：

```text
https://你的部署地址?apiKey={key}&baseUrl={address}
```

跳转后会自动打开配置弹窗并填入 API Key 与 Base URL。

<br>

## 文档

<table>
  <tr>
    <td>· <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a></td>
    <td>· <a href="docs/content/docs/overview/features.mdx">功能介绍</a></td>
  </tr>
  <tr>
    <td>· <a href="docs/content/docs/overview/render.mdx">Render 部署</a></td>
    <td>· <a href="docs/content/docs/overview/docker.mdx">Docker 部署</a></td>
  </tr>
  <tr>
    <td>· <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布节点操作手册</a></td>
    <td>· <a href="docs/content/docs/canvas/canvas-shortcuts.mdx">画布快捷键</a></td>
  </tr>
  <tr>
    <td>· <a href="docs/content/docs/progress/todo.mdx">待办事项</a></td>
    <td>· <a href="canvas-agent/README.md">C-ai Agent</a></td>
  </tr>
</table>
