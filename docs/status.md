# Status

Canonical owner of: current blockers and the delete-zone. Navigation lives in [README.md](../README.md). Durable decisions are in [docs/adr/](adr/).

Last verified against GitHub: 2026-10-30 (workflow runs on `main`).

## Blockers and cleanup

- **Two workflows deploy Pages and conflict.** `pages.yml` (this tracker's, uploads only `index.html` and `data/`) and `static.yml` (GitHub's starter, uploads the whole repository, including `scripts/`, `docs/`, `.claude/`) share the `pages` concurrency group. Observed on `main`: `static.yml` runs 1 and 3 succeeded (run 2 was cancelled); `pages.yml` run 1 failed (before Pages was enabled) and runs 2 and 3 were cancelled. Keep one. If `static.yml` is kept alone, it only triggers on pushes by people, so the hosted page would not redeploy after the bot's data commits (pushes with `GITHUB_TOKEN` do not trigger push workflows); it would then need a `workflow_run` trigger on "Refresh data" like `pages.yml` has. Decision pending.
- **The refresh workflow has not run yet.** No `data: refresh tracked skills` commit exists on `main`. It is the first real test of the live GitHub API calls (these were only fixture-tested; the authoring sandbox blocks `api.github.com`). Run "Refresh data" from the Actions tab and read its run summary. Expect a large first diff: most ECC descriptions are still empty.
- **Data is also changing outside the workflow.** `main` has "Daily sync" data commits made under the repository owner's account, not by the workflow. Whatever makes them can race the workflow's commits or overwrite its description fills. Source to be identified.
- **Refresh commits straight to `main`.** It fails if branch protection blocks `github-actions[bot]`; switch to opening PRs if so.
- **Open question: mcpmarket.com as a source.** The session could not reach it (host not allowed); not assessed.

## Manual / curated

- gstack and gbrain rows (no machine-readable listing yet).
- Category and bundle columns for all sources.

## Delete-zone

Nothing is marked for deliberate removal. `pages.yml` and `static.yml` overlap; see the first item above before removing either.
