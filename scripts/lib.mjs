// Pure helpers for the refresh job: frontmatter parsing and merging fetched rows into the table.

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let [, key, val] = kv;
    if (/^[>|][+-]?$/.test(val.trim())) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      val = parts.join(" ");
    }
    val = val.trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

export const rowKey = (r) => `${r.s}|${r.t}|${r.n}`;

// Merge freshly fetched rows (grouped by source name) into the existing table.
// Sources absent from `fresh` are left byte-for-byte untouched. Curated fields
// (category, bundle, links) survive a refresh; upstream owns description and url.
export function mergeTable(old, freshRaw) {
  const fresh = Object.fromEntries(Object.entries(freshRaw).map(([src, rows]) => [src, rows.map((r) => ({ ...r, s: src }))]));
  const changes = { added: [], changed: [], removed: [] };
  const freshByKey = new Map();
  for (const rows of Object.values(fresh)) for (const r of rows) freshByKey.set(rowKey(r), r);
  const seen = new Set();
  const next = [];
  for (const o of old) {
    if (!(o.s in fresh)) { next.push(o); continue; }
    const f = freshByKey.get(rowKey(o));
    if (!f) { changes.removed.push(o); continue; }
    seen.add(rowKey(o));
    const merged = { ...o, d: f.d || o.d, u: f.u };
    if (merged.d !== o.d || merged.u !== o.u) changes.changed.push(merged);
    next.push(merged);
  }
  for (const [src, rows] of Object.entries(fresh)) {
    for (const r of rows) {
      if (seen.has(rowKey(r))) continue;
      const row = { n: r.n, t: r.t, c: "—", s: src, b: r.b, d: r.d || "", l: [], u: r.u };
      next.push(row);
      changes.added.push(row);
    }
  }
  return { table: next, changes };
}

// Refuse to apply a listing that looks truncated or wrong.
// Pass { shrink: false } for sources read from disk, where deleting items (even all of them) is legitimate.
export function sanityCheck(source, oldCount, freshCount, { shrink = true } = {}) {
  if (shrink && freshCount === 0 && oldCount > 0) throw new Error(`${source}: listing returned 0 items (had ${oldCount})`);
  if (shrink && oldCount > 0 && freshCount < oldCount * 0.5)
    throw new Error(`${source}: listing shrank from ${oldCount} to ${freshCount}; refusing to apply`);
}
