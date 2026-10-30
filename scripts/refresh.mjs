#!/usr/bin/env node
// Re-reads each automated source, merges real changes into data/items.json,
// and stamps data/meta.json. A failing source is skipped and its rows are kept.
// Usage: node scripts/refresh.mjs [--dry-run]
import { readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeTable, sanityCheck } from "./lib.mjs";
import { GITHUB_SOURCES, fetchGithubSource, fetchLocalSkills } from "./sources.mjs";

export async function refresh({ root, fetchFn = fetch, token, today = new Date().toISOString().slice(0, 10), dryRun = false }) {
  const itemsPath = path.join(root, "data", "items.json");
  const old = JSON.parse(await readFile(itemsPath, "utf8"));
  const count = (s) => old.filter((r) => r.s === s).length;
  const fresh = {};
  const failures = [];

  const jobs = [
    ...GITHUB_SOURCES.map((cfg) => [cfg.source, () => fetchGithubSource(cfg, { fetchFn, token })]),
    ["this repo", () => fetchLocalSkills(root)],
  ];
  for (const [source, run] of jobs) {
    try {
      const rows = await run();
      sanityCheck(source, count(source), rows.length);
      fresh[source] = rows;
    } catch (e) {
      failures.push(`${source}: ${e.message}`);
    }
  }

  const { table, changes } = mergeTable(old, fresh);
  const changed = changes.added.length + changes.changed.length + changes.removed.length > 0;
  if (changed && !dryRun) {
    await writeFile(itemsPath, "[\n" + table.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n");
    await writeFile(path.join(root, "data", "meta.json"), JSON.stringify({ synced: today }) + "\n");
  }
  return { changed, changes, failures, refreshed: Object.keys(fresh) };
}

function summarize({ changes, failures, refreshed, changed }) {
  const names = (rows) => rows.slice(0, 20).map((r) => `\`${r.s}/${r.n}\``).join(", ") + (rows.length > 20 ? ", ..." : "");
  const lines = ["## Refresh summary", "", `Sources refreshed: ${refreshed.join(", ") || "none"}`, ""];
  for (const k of ["added", "changed", "removed"]) lines.push(`- **${k}:** ${changes[k].length}${changes[k].length ? " — " + names(changes[k]) : ""}`);
  if (!changed) lines.push("", "No changes.");
  if (failures.length) lines.push("", "### Failed sources (rows kept as-is)", ...failures.map((f) => `- ${f}`));
  return lines.join("\n") + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await refresh({ root, token: process.env.GITHUB_TOKEN, dryRun: process.argv.includes("--dry-run") });
  const text = summarize(result);
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  // Every source failing means the run verified nothing: make that visible.
  if (result.refreshed.length === 0) process.exitCode = 1;
}
