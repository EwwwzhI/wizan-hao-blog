---
title: TEST
description: A quick walkthrough of the streamlined Wutong Yu Astro site
pubDate: 2026-5-04
lastModDate: ''
ogImage: true
toc: true
search: true
---

The project keeps the Antfu-style visual language, but only preserves the parts needed for a small personal site: home, blog, projects, search, and theme switching.

## What The Site Keeps

- A homepage at `/`
- A blog index and blog detail pages under `/blogs`
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

