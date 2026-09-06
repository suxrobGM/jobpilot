"""Rewrite imports that go through a pass-through barrel to the declaring module, then drop it.

    python debarrel.py --list [prefix]        # pass-through barrels, one per line
    python debarrel.py --classify             # keep/drop verdict with the counts behind it
    python debarrel.py <barrel> [barrel ...]  # rewrite importers, then delete

Workspaces come from the root package.json; path aliases from each workspace's tsconfig
`compilerOptions.paths`. Set EXTRA_ROOTS for source outside `src/` that still imports through
aliases (build scripts, seeders) - importers there are invisible otherwise, and the deletion
leaves a dangling specifier that only the build catches.

A barrel is never deleted while anything still references it, so nested barrels need a second
run: the child is still held by its parent until the parent is processed.
"""

import argparse
import collections
import glob
import json
import os
import re
import sys

EXTRA_ROOTS = ["scripts", "prisma", "tools"]

RE_EXPORT_FROM = re.compile(r'^export\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)";', re.M | re.S)
RE_EXPORT_STAR = re.compile(r'^export\s+\*\s+from\s*"([^"]+)";', re.M)
RE_EXPORT_LOCAL = re.compile(
    r"^export\s+(?:declare\s+)?(?:async\s+)?"
    r"(?:const|let|var|function\*?|class|abstract\s+class|interface|type|enum)\s+([A-Za-z_$][\w$]*)",
    re.M,
)
RE_EXPORT_LOCAL_LIST = re.compile(r"^export\s+\{([^}]*)\}\s*;", re.M | re.S)
RE_IMPORT = re.compile(r'^import\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)";\s*?\n', re.M | re.S)


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


class Repo:
    def __init__(self, root):
        self.root = root.replace("\\", "/").rstrip("/")
        self.workspaces = self._workspaces()
        self.aliases = {ws: self._aliases(ws) for ws in self.workspaces}
        self.files = self._files()
        self.fileset = set(self.files)
        self._exports = {}

    def _workspaces(self):
        pkg = os.path.join(self.root, "package.json")
        patterns = json.loads(read(pkg)).get("workspaces", []) if os.path.exists(pkg) else []
        if isinstance(patterns, dict):
            patterns = patterns.get("packages", [])
        found = []
        for pattern in patterns:
            for path in glob.glob(os.path.join(self.root, pattern, "package.json")):
                found.append(os.path.relpath(os.path.dirname(path), self.root).replace("\\", "/"))
        return sorted(found) or ["."]

    def _aliases(self, ws):
        """`{"@/": "apps/api/src"}` from tsconfig paths; falls back to src/ when there are none."""
        out = {}
        for name in ("tsconfig.json", "jsconfig.json"):
            path = os.path.join(self.root, ws, name)
            if not os.path.exists(path):
                continue
            text = re.sub(r"//.*$", "", read(path), flags=re.M)
            text = re.sub(r",(\s*[}\]])", r"\1", text)
            try:
                opts = json.loads(text).get("compilerOptions", {})
            except json.JSONDecodeError:
                continue
            base = opts.get("baseUrl", ".")
            for spec, targets in (opts.get("paths") or {}).items():
                if not spec.endswith("*") or not targets:
                    continue
                target = targets[0]
                if not target.endswith("*"):
                    continue
                resolved = os.path.normpath(
                    os.path.join(ws, base, target[:-1])
                ).replace("\\", "/")
                out[spec[:-1]] = resolved.rstrip("/")
        if not out and os.path.isdir(os.path.join(self.root, ws, "src")):
            out["@/"] = f"{ws}/src".lstrip("./")
        return out

    def _files(self):
        out = []
        for ws in self.workspaces:
            for sub in ["src"] + EXTRA_ROOTS:
                base = os.path.join(self.root, ws, sub)
                for dirpath, _, names in os.walk(base):
                    for name in names:
                        if name.endswith((".ts", ".tsx")) and ".d." not in name:
                            full = os.path.join(dirpath, name)
                            out.append(os.path.relpath(full, self.root).replace("\\", "/"))
        return sorted(out)

    def workspace_of(self, path):
        best = None
        for ws in self.workspaces:
            if ws == "." or path.startswith(ws + "/"):
                if best is None or len(ws) > len(best):
                    best = ws
        return best

    def resolve(self, spec, from_file):
        """Module specifier -> repo-relative file, or None when it leaves the tracked sources."""
        if spec.startswith("."):
            base = os.path.normpath(
                os.path.join(os.path.dirname(from_file), spec)
            ).replace("\\", "/")
        else:
            ws = self.workspace_of(from_file)
            base = None
            for prefix, target in (self.aliases.get(ws) or {}).items():
                if spec.startswith(prefix):
                    base = f"{target}/{spec[len(prefix):]}"
                    break
            if base is None:
                return None
        for cand in (base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"):
            if cand in self.fileset:
                return cand
        return None

    def exports_of(self, path):
        if path in self._exports:
            return self._exports[path]
        text = read(os.path.join(self.root, path))
        table, stars = {}, []
        for m in RE_EXPORT_FROM.finditer(text):
            for src, alias, _ in split_names(m.group(2)):
                table[alias] = ("from", m.group(3), src)
        for m in RE_EXPORT_STAR.finditer(text):
            stars.append(m.group(1))
        for m in RE_EXPORT_LOCAL.finditer(text):
            table.setdefault(m.group(1), ("local", path, m.group(1)))
        for m in RE_EXPORT_LOCAL_LIST.finditer(text):
            for src, alias, _ in split_names(m.group(1)):
                table.setdefault(alias, ("local", path, src))
        self._exports[path] = (table, stars)
        return table, stars

    def declaring(self, name, path, depth=0):
        """Follow re-exports until the file that actually declares `name`."""
        if depth > 8:
            return None
        table, stars = self.exports_of(path)
        hit = table.get(name)
        if hit:
            kind, where, orig = hit
            if kind == "local":
                return where, orig
            target = self.resolve(where, path)
            return self.declaring(orig, target, depth + 1) if target else None
        for spec in stars:
            target = self.resolve(spec, path)
            if target:
                got = self.declaring(name, target, depth + 1)
                if got:
                    return got
        return None

    def package_entries(self):
        """Files a package.json `exports`/`main` addresses - deleting one breaks its consumers."""
        pinned = set()
        for ws in self.workspaces:
            path = os.path.join(self.root, ws, "package.json")
            if not os.path.exists(path):
                continue
            pkg = json.loads(read(path))
            targets = [pkg.get("main"), pkg.get("module"), pkg.get("types")]
            def walk(node):
                if isinstance(node, str):
                    targets.append(node)
                elif isinstance(node, dict):
                    for v in node.values():
                        walk(v)
            walk(pkg.get("exports"))
            for t in targets:
                if not t or "*" in t:
                    continue
                cand = os.path.normpath(os.path.join(ws, t)).replace("\\", "/")
                if cand in self.fileset:
                    pinned.add(cand)
        return pinned


def split_names(chunk):
    out = []
    for part in chunk.split(","):
        part = part.strip()
        if not part:
            continue
        is_type = part.startswith("type ")
        if is_type:
            part = part[5:].strip()
        if " as " in part:
            src, _, alias = part.partition(" as ")
            out.append((src.strip(), alias.strip(), is_type))
        else:
            out.append((part, part, is_type))
    return out


def is_pass_through(repo, path):
    text = read(os.path.join(repo.root, path))
    body = RE_EXPORT_FROM.sub("", text)
    body = RE_EXPORT_STAR.sub("", body)
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"^\s*//.*$", "", body, flags=re.M)
    return body.strip() == ""


def spec_for(repo, target, importer, original_spec):
    """Keep the importer's addressing style: an alias in stays an alias out."""
    base = re.sub(r"\.tsx?$", "", target)
    ws = repo.workspace_of(importer)
    for prefix, root in sorted((repo.aliases.get(ws) or {}).items(), key=lambda kv: -len(kv[1])):
        if original_spec.startswith(prefix) and base.startswith(root + "/"):
            return prefix + base[len(root) + 1:]
    rel = os.path.relpath(base, os.path.dirname(importer)).replace("\\", "/")
    return rel if rel.startswith(".") else "./" + rel


def stats(repo, barrel):
    """(distinct source files, importers outside the directory) - the keep/drop inputs."""
    text = read(os.path.join(repo.root, barrel))
    sources = set(RE_EXPORT_STAR.findall(text)) | {m.group(3) for m in RE_EXPORT_FROM.finditer(text)}
    stars = len(RE_EXPORT_STAR.findall(text))
    directory = os.path.dirname(barrel)
    outside = 0
    for f in repo.files:
        if f == barrel or f.startswith(directory + "/"):
            continue
        body = read(os.path.join(repo.root, f))
        if any(repo.resolve(s, f) == barrel for s in re.findall(r'from\s*"([^"]+)"', body)):
            outside += 1
    return len(sources), outside, stars


def rewrite(repo, barrels):
    barrels = set(barrels)
    changed, skipped = set(), []
    for f in repo.files:
        if f in barrels:
            continue
        path = os.path.join(repo.root, f)
        text = read(path)
        new_text, dirty = text, False
        for m in list(RE_IMPORT.finditer(text)):
            spec = m.group(3)
            if repo.resolve(spec, f) not in barrels:
                continue
            target = repo.resolve(spec, f)
            type_only = bool(m.group(1))
            groups, ok = collections.OrderedDict(), True
            for src, alias, is_type in split_names(m.group(2)):
                got = repo.declaring(src, target)
                if not got:
                    skipped.append((f, spec, src))
                    ok = False
                    break
                decl_file, decl_name = got
                key = spec_for(repo, decl_file, f, spec)
                token = decl_name if decl_name == alias else f"{decl_name} as {alias}"
                if is_type and not type_only:
                    token = "type " + token
                groups.setdefault((key, type_only), []).append(token)
            if not ok:
                continue
            lines = [
                f'{"import type" if t else "import"} {{ {", ".join(sorted(v))} }} from "{k}";\n'
                for (k, t), v in groups.items()
            ]
            new_text = new_text.replace(m.group(0), "".join(lines), 1)
            dirty = True
        if dirty:
            write(path, new_text)
            changed.add(f)
    return changed, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("barrels", nargs="*")
    ap.add_argument("--repo", default=os.getcwd())
    ap.add_argument("--list", nargs="?", const="", metavar="PREFIX")
    ap.add_argument("--classify", action="store_true")
    args = ap.parse_args()

    repo = Repo(args.repo)
    pinned = repo.package_entries()
    all_barrels = [f for f in repo.files if re.search(r"/index\.tsx?$", f)]

    if args.list is not None:
        for f in all_barrels:
            if f.startswith(args.list) and f not in pinned and is_pass_through(repo, f):
                print(f)
        return

    if args.classify:
        keep, drop = [], []
        for f in all_barrels:
            if not is_pass_through(repo, f):
                continue
            sources, outside, stars = stats(repo, f)
            if f in pinned:
                keep.append((f, sources, outside, "package.json exports"))
            elif stars:
                drop.append((f, sources, outside, "export *"))
            elif sources <= 1:
                drop.append((f, sources, outside, "single source file"))
            elif outside <= 1:
                drop.append((f, sources, outside, f"{outside} outside importer(s)"))
            else:
                keep.append((f, sources, outside, "carries a public API"))
        for label, rows in (("KEEP", keep), ("DROP", drop)):
            print(f"\n=== {label} ({len(rows)})")
            for f, sources, outside, why in rows:
                print(f"  {f}  sources={sources} importers={outside}  [{why}]")
        return

    targets = [b.strip().replace("\\", "/") for b in args.barrels]
    for b in list(targets):
        if b in pinned:
            print(f"REFUSED (package.json exports addresses it): {b}")
            targets.remove(b)
        elif not is_pass_through(repo, b):
            print(f"REFUSED (has real code, not a pass-through): {b}")
            targets.remove(b)
    if not targets:
        sys.exit("nothing to do")

    changed, skipped = rewrite(repo, targets)
    removed = []
    for b in targets:
        holders = set()
        for f in repo.files:
            if f == b or f in removed:
                continue
            body = read(os.path.join(repo.root, f))
            if any(repo.resolve(s, f) == b for s in re.findall(r'from\s*"([^"]+)"', body)):
                holders.add(f)
        if holders:
            print(f"STILL REFERENCED, kept: {b} <- {sorted(holders)[:4]}")
            continue
        os.remove(os.path.join(repo.root, b))
        removed.append(b)
    print(f"rewrote {len(changed)} files, removed {len(removed)}/{len(targets)} barrels")
    if skipped:
        print("UNRESOLVED (import left alone):")
        for row in skipped:
            print("  ", row)


if __name__ == "__main__":
    main()
