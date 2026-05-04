# Wutong Yu

A streamlined Astro site that keeps the Antfu-style visual language while focusing on three core destinations: home, blog, and projects.

## Core Features

- Home page at `/`
- Blog index and blog detail pages under `/blog`
- Project showcase page at `/projects`
- GitHub external link in the top navigation
- Blog-only search powered by Pagefind
- Light and dark theme switching
- Responsive layout and accessible navigation

## Project Structure

```text
src/
  components/
    base/
    nav/
    toc/
    views/
    widgets/
  content/
    blog/
    home/
    projects/
  layouts/
  pages/
  styles/
  utils/
plugins/
public/
```

## Content Overview

- `src/content/home/index.md`: homepage body content
- `src/content/blog/`: blog posts used by `/blog` and `/blog/[...slug]`
- `src/content/projects/data.json`: grouped project data for `/projects`
- `src/config.ts`: site metadata, navigation, and feature switches

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm preview
```

## Function Slimming Notes

This repository is a trimmed variant of the original `astro-antfustyle-theme`, with the following removals already applied:

- Removed extra pages such as photos, shorts, changelog, feeds, streams, releases, and pull requests
- Removed unused integrations and loaders tied to GitHub activity, RSS, Bluesky, and comments
- Removed non-essential repository metadata such as upstream GitHub workflows, issue templates, and VS Code workspace presets
- Removed most documentation-style demo posts and their local asset folders, keeping only a minimal set of representative blog content
- Removed stale configuration fields and type definitions that no longer participate in the current feature set

Retained features:

- Home, blog, blog detail, and projects pages
- GitHub nav link and extensible social link structure
- Blog-only search
- Article TOC on blog detail pages
- Theme switching
- OG image generation for current pages and posts

## Notes

- Generated directories such as `.astro/` and `dist/` are not source files and can be recreated at any time.
- OG images for active pages and posts are regenerated during development or build when needed.
