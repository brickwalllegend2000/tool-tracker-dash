// Source adapters. Each returns [{n, t, b, d, u}] for one source, or throws.
// Sources not listed here (gstack, gbrain) are curated by hand and never touched.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./lib.mjs";

const RAW = "https://raw.githubusercontent.com";

export const GITHUB_SOURCES = [
  {
    source: "anthropic",
    repo: "anthropics/skills",
    branch: "main",
    kinds: [{ type: "skill", re: /^skills\/([^/]+)\/SKILL\.md$/, bundle: "skills/", url: (n) => `https://github.com/anthropics/skills/tree/main/skills/${n}` }],
  },
  {
    source: "ECC",
    repo: "affaan-m/ECC",
    branch: "main",
    kinds: [
      { type: "skill", re: /^skills\/([^/]+)\/SKILL\.md$/, bundle: "skills/", url: (n) => `https://github.com/affaan-m/ECC/tree/main/skills/${n}` },
      { type: "agent", re: /^agents\/([^/]+)\.md$/, bundle: "agents/", url: (n) => `https://github.com/affaan-m/ECC/blob/main/agents/${n}.md` },
    ],
  },
];

async function getJson(url, fetchFn, token) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "tool-tracker-dash" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetchFn(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

export async function fetchGithubSource(cfg, { fetchFn = fetch, token } = {}) {
  const tree = await getJson(`https://api.github.com/repos/${cfg.repo}/git/trees/${cfg.branch}?recursive=1`, fetchFn, token);
  if (tree.truncated) throw new Error(`${cfg.source}: git tree truncated; cannot trust listing`);
  const found = [];
  for (const e of tree.tree) {
    if (e.type !== "blob") continue;
    for (const k of cfg.kinds) {
      const m = k.re.exec(e.path);
      if (m) found.push({ k, name: m[1], file: e.path });
    }
  }
  return mapLimit(found, 8, async ({ k, name, file }) => {
    let d = "";
    try {
      const res = await fetchFn(`${RAW}/${cfg.repo}/${cfg.branch}/${file}`);
      if (res.ok) d = parseFrontmatter(await res.text()).description || "";
    } catch { /* description stays empty; merge keeps the previous one */ }
    return { n: name, t: k.type, b: k.bundle, d, u: k.url(name) };
  });
}

// This repo's own skills: existence is verified from disk; curated descriptions are kept.
export async function fetchLocalSkills(root) {
  const dir = path.join(root, ".claude", "skills");
  const rows = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    try {
      const text = await readFile(path.join(dir, e.name, "SKILL.md"), "utf8");
      parseFrontmatter(text);
      rows.push({
        n: e.name, t: "skill", b: ".claude/skills", d: "",
        u: `https://github.com/brickwalllegend2000/tool-tracker-dash/blob/main/.claude/skills/${e.name}/SKILL.md`,
      });
    } catch { /* no SKILL.md: not a skill */ }
  }
  return rows;
}
