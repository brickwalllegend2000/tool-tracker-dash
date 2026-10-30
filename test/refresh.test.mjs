import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseFrontmatter, mergeTable, sanityCheck } from "../scripts/lib.mjs";
import { refresh } from "../scripts/refresh.mjs";

const row = (s, n, extra = {}) => ({ n, t: "skill", c: "Cat", s, b: "curated", d: "old", l: ["x"], u: `https://github.com/o/r/tree/main/skills/${n}`, ...extra });

test("parseFrontmatter handles plain, quoted and folded values", () => {
  const fm = parseFrontmatter('---\nname: a\ndescription: "Quoted: yes"\n---\nbody');
  assert.equal(fm.description, "Quoted: yes");
  const folded = parseFrontmatter("---\ndescription: >\n  line one\n  line two\nother: z\n---\n");
  assert.equal(folded.description, "line one line two");
  assert.deepEqual(parseFrontmatter("no frontmatter"), {});
});

test("mergeTable: untouched sources are identical, curated fields survive, diffs are reported", () => {
  const old = [row("A", "keep"), row("A", "gone"), row("B", "manual")];
  const fresh = { A: [{ n: "keep", t: "skill", b: "skills/", d: "new desc", u: old[0].u }, { n: "fresh", t: "skill", b: "skills/", d: "d", u: "https://x" }] };
  const { table, changes } = mergeTable(old, fresh);
  assert.deepEqual(table.find((r) => r.s === "B"), old[2]);
  const kept = table.find((r) => r.n === "keep");
  assert.equal(kept.d, "new desc");
  assert.equal(kept.c, "Cat");
  assert.deepEqual(kept.l, ["x"]);
  assert.deepEqual(changes.removed.map((r) => r.n), ["gone"]);
  assert.deepEqual(changes.added.map((r) => r.n), ["fresh"]);
  assert.equal(changes.changed.length, 1);
});

test("mergeTable: empty upstream description keeps the old one", () => {
  const old = [row("A", "k")];
  const { changes, table } = mergeTable(old, { A: [{ n: "k", t: "skill", b: "", d: "", u: old[0].u }] });
  assert.equal(table[0].d, "old");
  assert.equal(changes.changed.length, 0);
});

test("sanityCheck rejects empty and collapsed listings", () => {
  assert.throws(() => sanityCheck("A", 10, 0));
  assert.throws(() => sanityCheck("A", 10, 4));
  assert.throws(() => sanityCheck("A", 3, 1));
  assert.doesNotThrow(() => sanityCheck("A", 4, 2));
  assert.doesNotThrow(() => sanityCheck("A", 3, 1, { shrink: false }));
  assert.doesNotThrow(() => sanityCheck("A", 10, 9));
  assert.doesNotThrow(() => sanityCheck("A", 0, 3));
});

async function fixtureRepo(items) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ttd-"));
  await mkdir(path.join(root, "data"));
  await mkdir(path.join(root, ".claude", "skills", "mine"), { recursive: true });
  await writeFile(path.join(root, ".claude", "skills", "mine", "SKILL.md"), "---\nname: mine\ndescription: x\n---\n");
  await writeFile(path.join(root, "data", "items.json"), JSON.stringify(items));
  return root;
}

// ECC is "down" so fixtures only exercise the anthropic + local sources.
const eccDown = (fn) => async (url, o) => (url.includes("repos/affaan-m/ECC") ? { ok: false, status: 500 } : fn(url, o));
const localRow = { n: "mine", t: "skill", c: "Governance", s: "this repo", b: ".claude/skills", d: "curated", l: [], u: "https://github.com/brickwalllegend2000/tool-tracker-dash/blob/main/.claude/skills/mine/SKILL.md" };
const manualRow = row("gstack", "/office-hours", { t: "command" });

function fakeFetch({ tree, files = {}, treeStatus = 200 }) {
  return async (url) => {
    if (url.includes("api.github.com")) {
      return treeStatus === 200 ? { ok: true, json: async () => tree } : { ok: false, status: treeStatus };
    }
    const key = Object.keys(files).find((k) => url.endsWith(k));
    return key ? { ok: true, text: async () => files[key] } : { ok: false, status: 404 };
  };
}

test("refresh: applies real changes, stamps meta, leaves manual sources alone", async () => {
  const anth = row("anthropic", "pdf", { b: "document-skills" });
  const root = await fixtureRepo([anth, localRow, manualRow]);
  const tree = { truncated: false, tree: [{ type: "blob", path: "skills/pdf/SKILL.md" }, { type: "blob", path: "skills/new/SKILL.md" }, { type: "blob", path: "README.md" }] };
  const files = { "skills/pdf/SKILL.md": "---\ndescription: PDF stuff\n---\n", "skills/new/SKILL.md": "---\ndescription: Brand new\n---\n" };
  // ECC fails (404 tree): its absence must not affect anything.
  const fetchFn = eccDown(fakeFetch({ tree, files }));
  const r = await refresh({ root, fetchFn, today: "2030-01-02" });
  assert.equal(r.changed, true);
  assert.deepEqual(r.refreshed.sort(), ["anthropic", "this repo"]);
  assert.equal(r.failures.length, 1);
  const out = JSON.parse(await readFile(path.join(root, "data", "items.json"), "utf8"));
  assert.equal(out.find((x) => x.n === "pdf").d, "PDF stuff");
  assert.equal(out.find((x) => x.n === "pdf").b, "document-skills");
  assert.equal(out.find((x) => x.n === "new").s, "anthropic");
  assert.deepEqual(out.find((x) => x.s === "gstack"), manualRow);
  assert.equal(out.find((x) => x.n === "mine").d, "curated");
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "data", "meta.json"), "utf8")), { synced: "2030-01-02" });
});

test("refresh: no change means no write; dry-run never writes; failures keep rows", async () => {
  const anth = row("anthropic", "pdf", { d: "PDF stuff", u: "https://github.com/anthropics/skills/tree/main/skills/pdf" });
  const root = await fixtureRepo([anth, localRow]);
  const tree = { truncated: false, tree: [{ type: "blob", path: "skills/pdf/SKILL.md" }] };
  const files = { "skills/pdf/SKILL.md": "---\ndescription: PDF stuff\n---\n" };
  const ok = eccDown(fakeFetch({ tree, files }));
  const same = await refresh({ root, fetchFn: ok });
  assert.equal(same.changed, false);
  await assert.rejects(readFile(path.join(root, "data", "meta.json"), "utf8"));

  const dry = await refresh({ root, dryRun: true, fetchFn: eccDown(fakeFetch({ tree, files: { "skills/pdf/SKILL.md": "---\ndescription: changed\n---\n" } })) });
  assert.equal(dry.changed, true);
  assert.equal(JSON.parse(await readFile(path.join(root, "data", "items.json"), "utf8"))[0].d, "PDF stuff");

  const down = await refresh({ root, fetchFn: eccDown(fakeFetch({ tree: {}, treeStatus: 403 })) });
  assert.equal(down.changed, false);
  assert.ok(down.failures.some((f) => f.startsWith("anthropic")));
});

test("refresh: a truncated tree is rejected, not applied", async () => {
  const root = await fixtureRepo([row("anthropic", "pdf"), localRow]);
  const fetchFn = eccDown(fakeFetch({ tree: { truncated: true, tree: [] } }));
  const r = await refresh({ root, fetchFn });
  assert.equal(r.changed, false);
  assert.ok(r.failures.some((f) => /truncated/.test(f)));
});

test("refresh: rows with a stale upstream path survive by name and get their URL corrected", async () => {
  const stale = row("anthropic", "pdf", { b: "document-skills", d: "PDF stuff", u: "https://github.com/anthropics/skills/tree/main/document-skills/pdf" });
  const root = await fixtureRepo([stale, localRow]);
  const tree = { truncated: false, tree: [{ type: "blob", path: "skills/pdf/SKILL.md" }] };
  const r = await refresh({ root, fetchFn: eccDown(fakeFetch({ tree, files: { "skills/pdf/SKILL.md": "---\ndescription: PDF stuff\n---\n" } })) });
  assert.equal(r.changes.removed.length, 0);
  const out = JSON.parse(await readFile(path.join(root, "data", "items.json"), "utf8")).find((x) => x.n === "pdf");
  assert.equal(out.u, "https://github.com/anthropics/skills/tree/main/skills/pdf");
  assert.equal(out.b, "document-skills");
});

test("refresh: local skills removed from disk are removed from the table", async () => {
  const gone = { ...localRow, n: "deleted-skill" };
  const root = await fixtureRepo([localRow, gone, { ...localRow, n: "also-gone" }]);
  const r = await refresh({ root, fetchFn: eccDown(fakeFetch({ tree: { truncated: false, tree: [] } })) });
  assert.deepEqual(r.changes.removed.map((x) => x.n).sort(), ["also-gone", "deleted-skill"]);
});
