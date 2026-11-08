// Real agent activity for an on-screen counter: every Claude Code tool call, with its timestamp,
// from the session transcripts (subagents included) inside named wall-clock windows.
//   node tool-calls.mjs <transcripts-dir> <out.json> name=<startISO>..<endISO> [...] [--skip <sessionId>]
// <transcripts-dir> is ~/.claude/projects/<cwd-slug>; --skip your own filming session.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const [dir, out] = args;
const skip = args.includes("--skip") ? args[args.indexOf("--skip") + 1] : null;
const windows = args
  .slice(2)
  .filter((a) => a.includes("..") && a.includes("="))
  .map((a) => {
    const [name, range] = a.split("=");
    const [from, to] = range.split("..");
    return { name, from, to };
  });

const files = [];
for (const entry of fs.readdirSync(dir)) {
  if (skip && entry.startsWith(skip)) {
    continue;
  }
  const full = path.join(dir, entry);
  if (entry.endsWith(".jsonl")) {
    files.push(full);
  }
  const subagents = path.join(full, "subagents");
  if (fs.existsSync(subagents)) {
    for (const s of fs.readdirSync(subagents).filter((f) => f.endsWith(".jsonl"))) {
      files.push(path.join(subagents, s));
    }
  }
}

// A tool_use can be logged twice (streamed + final); its id dedupes it.
const seen = new Set();
const uses = [];
for (const file of files) {
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    let line;
    try {
      line = JSON.parse(raw);
    } catch {
      continue;
    }
    const content = line.message?.content;
    if (!Array.isArray(content) || !line.timestamp) {
      continue;
    }
    for (const block of content) {
      if (block.type === "tool_use" && !seen.has(block.id)) {
        seen.add(block.id);
        uses.push({ at: line.timestamp, name: block.name.split("__").pop() });
      }
    }
  }
}
uses.sort((a, b) => a.at.localeCompare(b.at));

const result = {};
for (const w of windows) {
  result[w.name] = uses.filter((u) => u.at >= w.from && u.at <= w.to);
  console.log(w.name, result[w.name].length, "tool calls");
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
