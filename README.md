# EwwwzhI Personal Site

一个基于 Astro 6 的个人档案站，用来维护首页简介、博客、项目展示和站内搜索。

当前仓库已经收敛为个人使用的简洁版本：保留核心内容链路，移除低频扩展模块，后续主要通过 Markdown 和 JSON 填内容。

## 功能

- 首页 `/`：个人简介和常用入口
- 博客 `/blogs/`：按年份展示博客文章
- 博客详情 `/blogs/[slug]/`：文章正文、TOC、代码高亮、搜索索引
- 项目 `/projects/`：按分类展示项目卡片
- 搜索：Pagefind，仅索引博客正文
- 明暗主题切换
- sitemap 和 OG image

## 环境要求

- Node.js `>=22.12.0`
- pnpm `10.28.0`

第一次使用：

```bash
pnpm install
pnpm dev
```

日常开发如果依赖没有变化，直接运行：

```bash
pnpm dev
```

## 常用命令

```bash
pnpm dev          # 启动本地开发服务器
pnpm check        # Astro 类型与内容检查
pnpm build        # 构建生产站点，并生成 Pagefind 索引
pnpm preview      # 本地预览生产构建
pnpm lint         # ESLint 检查
pnpm format       # Prettier 格式检查
```

## 内容维护

### 修改首页

编辑：

```text
src/content/home/index.md
```

首页页面入口在：

```text
src/pages/index.mdx
```

### 新增博客

复制模板：

```text
src/content/blogs/template.md
```

改成新的文件名，例如：

```text
src/content/blogs/my-first-post.md
```

发布前把 frontmatter 里的：

```yaml
draft: true
```

改成：

```yaml
draft: false
```

博客模板字段示例：

```yaml
---
title: 我的文章标题
subtitle: 可选副标题
description: 用于 SEO 和分享的简短描述
tags:
  - Astro
  - Notes
pubDate: 2026-01-01
lastModDate: ''
minutesRead: true
ogImage: true
toc: true
search: true
draft: false
---
```

### 新增项目

编辑：

```text
src/content/projects/data.json
```

项目数据示例：

```json
[
  {
    "id": "my-project",
    "link": "https://github.com/your-name/my-project",
    "desc": "项目的一句话说明",
    "icon": "i-carbon:application",
    "category": "Tools"
  }
]
```

`icon` 使用 UnoCSS / Iconify 图标名，格式类似：

```text
i-carbon:application
i-simple-icons-github
```

## 站点配置

主要配置在：

```text
src/config.ts
```

常改内容：

- `SITE.title`：站点标题
- `SITE.description`：站点描述
- `SITE.website`：部署后的完整域名
- `UI.internalNavs`：顶部导航
- `UI.socialLinks`：社交链接
- `FEATURES.search`：搜索配置

当前内容集合只保留：

```text
home
blogs
projects
```

## 文档

- `doc/项目解析.md`：当前简洁版结构和维护说明
- `doc/feature/文章TOC与响应式导航说明.md`：文章 TOC 与响应式导航
- `doc/notes/LogoButton图标替换说明.md`：左上角 logo 使用说明

## 构建说明

`pnpm build` 会先运行 Astro 构建，再通过 `postbuild` 生成 Pagefind 搜索索引：

```json
"postbuild": "pagefind --site dist --exclude-selectors \"pre\" --include-characters \"<>\" && node ./scripts/postbuild.mjs"
```

搜索只收录设置了 `search: true` 的博客正文。草稿文章在生产构建中会被过滤，因此不会进入搜索索引。
