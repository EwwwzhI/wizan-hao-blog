# Project Memory

This file contains the small set of facts an agent should know before modifying
the repository. Keep it current and concise; Git remains the source of truth
for detailed history.

## Current Architecture

- Astro 6 static personal site using TypeScript, MDX/Markdown, and UnoCSS.
- Routes live in `src/pages/`; reusable UI lives in `src/components/`.
- Content collections are limited to `home`, `blogs`, and `projects`.
- Blog content is stored in `src/content/blogs/`; project data is stored in
  `src/content/projects/data.json`.
- `pnpm build` also creates the Pagefind blog index and generated OG assets.

## Working Conventions

- Use Node.js 22.12+ and pnpm 10.28.
- Validate material changes with `pnpm check`, `pnpm lint`, `pnpm format`, and
  `pnpm build`.
- Do not edit generated directories: `.astro/` and `dist/`.
- Preserve unrelated working-tree changes; this repository may be edited
  outside the current agent task.
- Use `src/content/blogs/template.md` when creating a post and keep new posts
  as drafts until explicitly published.

## Active Decisions

- Git records complete change history.
- `CHANGELOG.md` records a human-readable summary of material changes.
- This file records only durable context needed for future decisions.
- New architectural decisions should state the decision, reason, and affected
  paths. Replace obsolete decisions rather than leaving conflicting guidance.

## Known Risks and Follow-ups

- There is no dedicated automated test suite. Type checks, linting, formatting,
  production builds, and manual route checks are the current quality gates.
- Search indexes only eligible blog pages; changes to content filtering should
  be verified against the generated Pagefind output.
