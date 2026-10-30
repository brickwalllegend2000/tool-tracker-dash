# 0001: Plain static HTML, a JSON data file, and an Actions-driven refresh

Status: accepted · Date: 2026-10-30

## Context

The tracker needs to be easy to see and usable with no infrastructure. The first version embedded all rows inside `index.html`, which left nothing for an automated job to diff and shipped with a JavaScript error that stopped any row from rendering.

## Decisions

1. **Plain HTML, no Jekyll or other generator.** One static page, no build step. A generator adds a runtime and templates and gains nothing for a single table. The README's "no build, no framework, no server" rule stays.
2. **Data lives in `data/items.json` (one row per line) and `data/meta.json`.** The page loads them with `fetch`, so it must be served over HTTP; opening the file directly shows an error message pointing at `python3 -m http.server`. One row per line keeps refresh diffs reviewable.
3. **The refresh runs as a GitHub Actions workflow and commits to `main`.** Runs are visible in the Actions tab and the run summary lists added, changed, and removed rows. Chosen over opening a PR each time to keep it hands-off; switching is one change in `.github/workflows/refresh.yml`. Pushes made with `GITHUB_TOKEN` do not trigger other push workflows, so the deploy listens for the refresh workflow finishing.
4. **Automated sources: anthropics/skills, ECC, and this repo's own skills. gstack and gbrain stay hand-curated** until each has a machine-readable listing. Adding a source means adding one adapter plus fixture tests.
5. **Rows are matched by source, type, and name, never by path.** Upstream layout moves (for example Anthropic's document skills now live under `skills/`) are absorbed: the row survives, its URL is corrected, and curated category, bundle, and links are kept. Upstream owns description and URL.
6. **A failing or implausible listing is skipped, not applied.** A remote source that errors, returns nothing, or shrinks below half its previous size keeps its existing rows. This repo's own skills are read from disk and are exempt, since deleting a local skill is legitimate.
7. **`meta.json` records the date of the last data change**, not the last run, to avoid a daily empty commit. The page labels it "Data updated".

## Consequences

- The first live run of the workflow against the real GitHub API is the real test; fixture tests and real-file parser checks cannot cover the tree-listing calls.
- A standalone single-file `tracker.html` that opens without a server was discussed and not built; it would be a generated artifact, not a second source of truth.
