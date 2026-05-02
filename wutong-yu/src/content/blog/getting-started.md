---
title: Getting Started
description: A quick walkthrough of the streamlined Wutong Yu Astro site
pubDate: 2024-10-04
lastModDate: ''
ogImage: true
toc: true
search: true
---

This post gives a compact overview of the streamlined `wutong-yu` site. The project keeps the Antfu-style visual language, but only preserves the parts needed for a small personal site: home, blog, projects, search, and theme switching.

## What The Site Keeps

- A homepage at `/`
- A blog index and blog detail pages under `/blog`
- A grouped projects page at `/projects`
- A GitHub icon link in the top navigation
- Search powered by Pagefind, limited to blog posts
- Light and dark theme switching

## Local Development

Use `pnpm` to install dependencies and start the local server:

```bash
pnpm install
pnpm dev
```

Other useful commands:

- `pnpm check`
- `pnpm build`
- `pnpm preview`

## Authoring Content

The content model is intentionally small:

- `src/content/home/index.md` controls the homepage body.
- Files in `src/content/blog/` become blog posts.
- `src/content/projects/data.json` powers the grouped projects page.

## Where To Edit

- `src/config.ts` defines site metadata, navigation, search, and theme-related feature flags.
- `src/components/views/ListView.astro` renders the blog list.
- `src/components/views/RenderPost.astro` renders blog detail pages.
- `src/components/views/GroupView.astro` renders the projects page.

## Final Notes

This slimmed version is meant to stay easy to read and easy to maintain. If you want to extend it later, start from `src/config.ts` and add only the pages or collections you truly need.
