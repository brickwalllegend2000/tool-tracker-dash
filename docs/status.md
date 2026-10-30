# Status

Canonical owner of: current blockers and the delete-zone. Navigation lives in [README.md](../README.md).

## Blockers

- **GitHub Pages is not enabled.** One-time manual step: Settings → Pages → Source: GitHub Actions. Until then the hosted page does not exist; local use works (`python3 -m http.server`).
- **Live refresh is untested against the real GitHub API.** Adapters are covered by fixture tests and the frontmatter parser was checked on real upstream files, but the tree-listing calls were only exercised in a sandbox that blocks `api.github.com`. First scheduled or manual run of "Refresh data" is the real test; check its run summary.
- **Refresh commits straight to `main`.** Fails if `main` has branch protection that blocks `github-actions[bot]`.

## Manual / curated

- gstack and gbrain rows (no machine-readable listing yet).
- Category and bundle columns for all sources.

## Delete-zone

Nothing is marked for deliberate removal.
