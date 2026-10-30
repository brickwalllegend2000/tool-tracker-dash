# tool-tracker-dash

A live dashboard-style tracker for agent skills, commands, and agents across a fixed set of upstream sources, inspired by [linny006/skills-tracker](https://github.com/linny006/skills-tracker).

## Purpose

This repo tracks the skills, commands, and agents exported by the gstack ecosystem and related sources, so that what exists, where it lives, how it is bundled, and what it links to is answerable from one table instead of repo-by-repo spelunking.

## Tracked sources

| Source | What it provides | URL |
| --- | --- | --- |
| gstack | Bundled commands/skills (56 rows in `data/items.json`), with bundle grouping and cross-links | https://github.com/garrytan/gstack |
| gbrain | Agent verbs (connect-coding-agent and related), an operating model rather than a skill list | https://github.com/garrytan/gbrain |
| anthropics/skills | Anthropic's published agent skills (`skills/` layout) | https://github.com/anthropics/skills |
| ECC | Harness operating system: skills, agents, commands, rules, hooks (`skills/`, `agents/` layout) | https://github.com/affaan-m/ECC |
| this repo | Locally adopted skills under `.claude/skills/` (explore → criteria → maintain) | — |

Other candidate sources may be added by PR; each source must be pinned to an exact listing URL so refreshes are reproducible.

## The table

One row per tracked item, grouped by source repo:

| Source | Type | Name | Category | Bundle | Linked tools / skills | Description | Upstream link |
| --- | --- | --- | --- | --- | --- | --- | --- |

Column contract:

- **Source** — the upstream repo the item belongs to (gstack, gbrain, ECC, or this repo).
- **Type** — `skill`, `command`, or `agent`.
- **Name** — the directory or file name as it appears upstream.
- **Category** — hand-curated grouping used by the page's filter (`—` when unassigned). Refreshes never overwrite it.
- **Bundle** — the upstream bundle/grouping it ships in, linked to the bundle's URL when one exists.
- **Linked tools / skills** — cross-references the item itself declares (imports, invokes, or recommends).
- **Description** — the one-line purpose from the item's frontmatter or docs.
- **Upstream link** — the deep link to the item's file or directory.

## Interface

`index.html` is the directory UI - a simpler version of hosted skills marketplaces like learn-skills.dev: one static page, one table, no build, no framework, no accounts, no likes, no install flow. Client-side search, source/category/type filters, and sort. Every row links straight to the upstream file.

Data lives in `data/items.json` (one row per line, so refresh diffs are readable) and `data/meta.json` (last-synced date). The page loads them with `fetch`, so serve the folder over HTTP rather than opening the file directly:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Hosted, the same files are published by GitHub Pages (enable it once under Settings → Pages → Source: GitHub Actions).

Simpler means: rows are metadata and links only, popularity signals (likes, stars, installs) are deliberately absent, and there is no server component. If a feature would require one, it does not belong in this repo.

## Refresh model

Like skills-tracker, the table is regenerated rather than hand-edited. `scripts/refresh.mjs` (Node 22, no dependencies) re-reads each automated source, merges only real changes into `data/items.json`, and stamps `data/meta.json`.

- **Automated sources:** anthropics/skills and ECC (GitHub tree listing plus each file's frontmatter), and this repo's `.claude/skills/`.
- **Curated sources:** gstack and gbrain have no machine-readable listing yet; their rows are edited by hand and the job never touches them. Add an adapter in `scripts/sources.mjs` when a feed exists.
- **Safety:** a source that fails, returns nothing, or shrinks below half its previous size is skipped and its rows are kept as-is. Curated fields (category, bundle, links) survive refreshes; upstream owns description and URL.
- **Where it runs:** `.github/workflows/refresh.yml` runs daily (and on demand from the Actions tab), runs the tests first, and commits to `main` only when data changed. The run summary lists what was added, changed, or removed. `.github/workflows/pages.yml` redeploys the page afterwards.
- **Run it yourself:** `node scripts/refresh.mjs --dry-run` previews changes without writing. `node --test` runs the tests.

## Non-goals

- Not a general project or task tracker.
- Not a mirror or fork of upstream repos: metadata and links only.
- No automatic adoption of tracked skills into `.claude/skills/` — that is a deliberate decision each time.

## Repository roles

- Constitution and agent instructions: [AGENTS.md](AGENTS.md)
- Map (this document): README.md
- Status: [docs/status.md](docs/status.md)
- Skills: `.claude/skills/` — `codebase-onboarding` (explore), `intent-driven-development` (criteria), `living-docs-governance` (maintain)

History role is deferred; Git carries routine changes and `docs/adr/` is for durable decisions.
