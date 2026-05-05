# Wutong-Yu-Blog

A streamlined Astro 5 personal site retaining the Antfu-style visual language, focused on four core destinations: home, blog, projects, and search.

## Core Features

- Home page at `/`
- Blog index at `/blogs/` and blog detail pages at `/blogs/[slug]/`
- Project showcase page at `/projects/`
- Pagefind-powered search across blog posts
- Light and dark theme switching with view transition animation
- Article TOC (table of contents) on blog detail pages
- Automatic OG image generation for posts and pages
- Three background effects: `plum`, `dot`, and `rose`

## Project Structure

```
src/
  components/
    base/       # Head, Link, Footer, Backdrop, PostMeta, Divider, etc.
    nav/         # NavBar, NavItem, NavSwitch
    toc/        # Toc, TocSidebar, TocItem
    views/      # RenderPage, RenderPost, ListView, ListItem, GroupView, GroupItem
    widgets/    # LogoButton, SearchSwitch, ThemeSwitch, BackLink, ToTopButton
    backgrounds/ # Background, Dot, Plum, Rose
  content/
    blog/       # Blog posts (Markdown / MDX)
    home/       # Homepage content
    projects/   # Project data (JSON)
  layouts/      # BaseLayout, StandardLayout
  pages/        # Routing layer
  styles/       # main.css, prose.css, markdown.css
  utils/        # path, datetime, data, misc, toc
plugins/        # remark/rehype plugins, OG image generation
public/         # Static assets (favicon, og-images, fonts, etc.)
```

## Content Overview

| File | Purpose |
| :--- | :--- |
| `src/content/home/index.md` | Homepage body content |
| `src/content/blog/*.md` | Blog posts rendered at `/blogs/` |
| `src/content/projects/data.json` | Project cards data |
| `src/config.ts` | Site metadata, navigation layout, and feature switches |

## Key Architecture

**4-layer data flow:**

```
src/content/* provides raw content
        ↓
src/content.config.ts + schema.ts validates and parses
        ↓
astro.config.ts + plugins/* processes Markdown / MDX
        ↓
src/pages/* defines routes
        ↓
src/layouts/* wraps page structure
        ↓
src/components/views/* assembles page content
        ↓
src/components/* + styles/* output final UI
```

**Horizontal support files:**

- `src/config.ts` — `SITE`, `UI`, `FEATURES` configuration consumed across the entire project
- `src/types.ts` — TypeScript types for config, components, and feature flags

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm preview
```

## Documentation

Detailed explanations for this project are kept in `doc/`:

- `doc/项目解析.md` — Full project architecture and data flow analysis
- `doc/LogoButton图标替换说明.md` — Logo replacement from text to SVG with theme switching
- `doc/字体修改.md` — Adding and applying local fonts
- `doc/页面调整.md` — Blog reading experience and TOC styling adjustments

## Function Slimming Notes

This repository is a trimmed variant of the original `astro-antfustyle-theme`. The following have already been removed:

- Extra pages: photos, shorts, changelog, feeds, streams, releases, pull requests
- Unused integrations: GitHub activity, RSS, Bluesky, comments
- Stale metadata: upstream workflows, issue templates, VS Code workspace presets
- Demo posts and assets, keeping only representative blog content

Retained features:

- Home, blog, blog detail, and projects pages
- GitHub nav link and extensible social link structure
- Blog-only search via Pagefind
- Article TOC on blog detail pages
- Theme switching with view transition
- OG image generation for active pages and posts
- Three background effects
