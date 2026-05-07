# Wutong-Yu-Blog

A streamlined Astro 5 personal site inspired by the Antfu-style visual language. This repository focuses on a small, opinionated feature set: homepage, blog, projects, and search, while keeping the codebase easy to extend.

## Overview

- Framework: Astro 5 + TypeScript
- Styling: UnoCSS + custom CSS
- Content: Markdown / MDX via Astro Content Collections
- Search: Pagefind (blogs only)
- UX: light/dark theme switching with view transitions
- Content extras: article TOC, reading-friendly blog layout, automatic OG image generation

## Feature Highlights

- Home page at `/`
- Blog index at `/blogs/` and article pages at `/blogs/[slug]/`
- Project showcase page at `/projects/`
- Full-text blog search powered by Pagefind
- Right-side article TOC for blog detail pages
- Automatic OG image generation for posts and core pages
- Three built-in background effects: `plum`, `dot`, and `rose`
- Social links and navigation configured from a single config file

## Tech Stack

- `astro` for routing, static generation, and content rendering
- `@astrojs/mdx` for MDX support
- `unocss` for utility-first styling
- `astro-expressive-code` for code block presentation
- `pagefind` for static search indexing
- `sharp` + `satori` for image and OG generation
- `eslint` + `prettier` for code quality and formatting

## Requirements

- Node.js `18.20.8`, `20.9.0+`, or `22+`
- `pnpm@10.28.0`

## Quick Start

```bash
pnpm install
pnpm dev
```

Then open the local Astro dev server shown in the terminal.

## Available Commands

```bash
pnpm dev          # start local development server
pnpm check        # run Astro type/content checks
pnpm build        # create production build
pnpm preview      # preview the production build locally
pnpm lint         # run ESLint
pnpm lint:fix     # fix lint issues where possible
pnpm format       # check formatting with Prettier
pnpm format:write # format files with Prettier
```

## Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Homepage |
| `/blogs/` | Blog index |
| `/blogs/[slug]/` | Blog post detail page |
| `/projects/` | Project showcase |
| `/search/` | Search page powered by Pagefind |

## Content And Customization

| File | Purpose |
| :--- | :--- |
| `src/content/home/index.md` | Homepage body content |
| `src/content/blog/*.md` | Blog posts rendered at `/blogs/` |
| `src/content/projects/data.json` | Project card data |
| `src/config.ts` | Site metadata, nav items, social links, and feature switches |
| `astro.config.ts` | Astro integrations, Markdown pipeline, image config, and build settings |

### Main Config Entry Points

- `SITE` in `src/config.ts`: website URL, title, description, locale, image domains
- `UI` in `src/config.ts`: internal navs, social links, navbar layout, post/group display rules
- `FEATURES` in `src/config.ts`: TOC, search, slide animation, OG image defaults

## Project Structure

```text
src/
  components/
    backgrounds/  # Background, Dot, Plum, Rose
    base/         # Head, Link, Footer, Backdrop, PostMeta, Divider
    nav/          # NavBar, NavItem, NavSwitch
    toc/          # Toc, TocSidebar, TocItem
    views/        # RenderPage, RenderPost, ListView, GroupView
    widgets/      # LogoButton, SearchSwitch, ThemeSwitch, BackLink
  content/
    blog/         # Blog posts (Markdown / MDX)
    home/         # Homepage content
    projects/     # Project data (JSON)
  layouts/        # BaseLayout, StandardLayout
  pages/          # Route definitions
  styles/         # main.css, prose.css, markdown.css
  utils/          # path, datetime, data, misc, toc helpers
plugins/          # remark/rehype plugins, OG helpers
public/           # Static assets such as favicon, fonts, and generated images
doc/              # Project notes and customization documents
```

## Architecture Notes

**Content flow**

```text
src/content/*                -> raw Markdown / MDX / JSON content
src/content.config.ts        -> schema validation and parsing
astro.config.ts + plugins/*  -> Markdown / MDX processing
src/pages/*                  -> route generation
src/layouts/*                -> page shell
src/components/views/*       -> page-level composition
src/components/* + styles/*  -> final UI output
```

**Cross-cutting files**

- `src/config.ts` centralizes site, UI, and feature configuration
- `src/types.ts` defines shared TypeScript types for config and features

## Documentation

Project-specific notes are kept in `doc/`:

- `doc/项目解析.md` - Full project architecture and data flow analysis
- `doc/文章TOC与响应式导航说明.md` - TOC behavior and responsive navigation details
- `doc/页面调整.md` - Blog reading experience and page-level adjustments
- `doc/BUG修复-页面间距统一.md` - Notes on page spacing fixes
- `doc/LogoButton图标替换说明.md` - Logo replacement from text to SVG with theme switching
- `doc/字体修改.md` - Adding and applying local fonts

## Positioning

This repository is a trimmed variant of the original `astro-antfustyle-theme`. It removes less relevant modules and keeps a smaller, easier-to-maintain surface area.

Removed or excluded parts:

- Extra pages such as photos, shorts, changelog, feeds, streams, releases, and pull requests
- Unused integrations such as GitHub activity, RSS, Bluesky, and comments
- Upstream boilerplate metadata and demo-oriented assets

Retained core experience:

- Home, blog, blog detail, projects, and search
- Config-driven social links and navbar layout
- Blog-only search via Pagefind
- Article TOC on post pages
- Theme switching with view transitions
- OG image generation for active pages and posts
- Multiple background effects
