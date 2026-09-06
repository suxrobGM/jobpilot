---
name: knip-cleanup
description: Add knip to a TypeScript project and use it to remove dead exports, collapse pass-through barrels, and narrow every export to what another file actually imports. Trigger on "add knip", "set up knip", "find dead code", "remove unused exports", "clean up barrel files", "get rid of export *", "why is this exported".
metadata:
  version: "1.0"
---

# Knip Integration and Barrel Cleanup

Four phases, each one committed and verified on its own. Later phases depend on earlier ones:
every deletion exposes another layer of dead code, so knip is re-run between them rather than once
at the start.

Do not start at phase 3. A knip baseline full of false positives will delete something real.

## Phase 0: measure before believing the complaint

If the user also reports line-ending churn on every format, check before changing anything:

```bash
git ls-files --eol | awk '{print $1, $2}' | sort | uniq -c | sort -rn | head
<formatter> --check .    # biome check . / prettier --check .
```

`i/lf w/lf` across the board with a clean formatter run means the tracked tree is already
normalized and the churn is in **newly created** files. The fix is prevention, not renormalizing:
`.editorconfig` with `end_of_line = lf`, the editor's own EOL setting (`"files.eol": "\n"` for
VS Code), and `git config core.autocrlf false` locally. Renormalizing a tree that is already LF
produces a huge no-op diff and fixes nothing.

## Phase 1: a baseline that is actually true

Install knip at the **repo root**, one config, one script. In a monorepo never give each package
its own config: a per-workspace run cannot see that another workspace imports the symbol, so every
shared export reads as dead.

```jsonc
{
  "$schema": "https://unpkg.com/knip@<major>/schema.json",
  "tags": ["-knipignore"],
  "workspaces": {
    "packages/lib": {
      "entry": ["src/index.ts", "src/**/*.test.ts"],
      "project": ["src/**/*.ts"],
      "includeEntryExports": true,
      "ignoreExportsUsedInFile": true
    }
  }
}
```

Then iterate until the report contains **only real findings**. Expect these, in this order:

- **Every compiled entrypoint must be listed.** Grep the Dockerfiles, CI, and build scripts for
  `--outfile`, `--entry`, `bun build`, `esbuild`. A second binary built from `src/worker.ts` is
  invisible to knip and its whole dependency tree reports as unused.
- **Config files that read env at load time** (`prisma.config.ts` and friends) crash knip's plugin
  loader. Disable that plugin (`"prisma": false`) rather than faking the variable.
- **`includeEntryExports: true` wherever `package.json` `exports` uses wildcards.** A map like
  `"./utils/*": "./src/utils/*.ts"` makes *every file* an entry, and knip then reports nothing at
  all for that package. Verify by adding a deliberately unused export and confirming knip sees it
  — silence is the failure mode here, so it will not announce itself.
- **Framework-indirect dependencies** (`@prisma/client`, `pg`, a JWT lib reached through a plugin)
  go in `ignoreDependencies`. Check each one is genuinely reached before ignoring it.
- **Type-level assertions are not dead code.** A `type XInSync = [Assert<A, B>, Assert<B, A>]`
  drift guard has no runtime caller by design. Tag it `@knipignore` (with `"tags": ["-knipignore"]`
  in the config) and say in a comment what it guards. Deleting it silently removes a check.

Commit the config and the script separately from any deletion.

## Phase 2: dead exports, before touching barrels

Pure subtraction, no import churn, so it lands cleanly and reviews easily.

Cross-check every finding against a repo-wide grep before deleting. `files=1 refs=1` (the
declaration is the only occurrence) is safe. More than that needs a look, and the reasons split
into four:

| What grep shows | What it means | What to do |
| --- | --- | --- |
| Only the declaration | Truly dead | Delete |
| A same-named declaration in another workspace | Duplicate, this copy is dead | Delete this one |
| Hits only in a barrel's re-export line | The forwarding line is dead, not the symbol | Handle in phase 3 |
| Hits in a comment | Not a reference | Delete |

Then delete, and **re-run knip after deleting**: removing a function usually orphans the data
tables and helper types it used, which were invisible while it existed.

Two traps when automating the deletion:

- Deleting a declaration by brace balance breaks on chained expressions
  (`export const x = new Builder().use(a).derive(b)`) — the balance returns to zero mid-chain.
  Verify with a lint run and hand-edit the mangled file rather than tuning the heuristic.
- Deletions strand imports and module-level state. Run the formatter's unsafe autofix
  (`biome check --write --unsafe`, `eslint --fix`) on the touched files, then read what it could
  not fix.

## Phase 3: barrels, by whether they earn their keep

State the rule before writing any code, because it decides the size of the diff. A barrel stays
only when **it aggregates more than one file and has more than one importer outside its own
directory**. Everything else is indirection: `export *`, single-file forwarders, and barrels with
one caller.

Classify first and show the counts — the split is usually lopsided and tells you where the real
work is. In one monorepo it was 168 barrels: 74 `export *`, 75 named, 18 with real code; after the
rule, all 45 survivors were frontend component aggregators and the backend kept none.

Two barrels must never be deleted:

- Anything `package.json` `exports` points at. Deleting `src/utils/index.ts` when the map says
  `"./utils": "./src/utils/index.ts"` breaks every consumer, and **typecheck inside that package
  still passes** — the break only shows up in the packages that import it. `export *` is
  defensible in exactly this position, since the subpath is the unit of API.
- A barrel that a *surviving* barrel re-exports from. Repoint the parent's `export ... from` lines
  at the concrete files first, then drop the child.

`references/debarrel.py` does the rewrite: it builds an export table for every file, follows
re-exports transitively to the declaring module, rewrites importers, and refuses to delete a
barrel anything still references. Run it in batches by directory, and run it twice — a nested
barrel is still referenced by its parent until the parent is processed.

Verify with a **real build**, not just typecheck. Barrel changes affect bundling and, in Next.js,
server/client boundaries.

## Phase 4: export only what is needed

Flip `ignoreExportsUsedInFile` to `false`. What it reports is every symbol exported but never
imported anywhere else — the actual answer to "why is this exported".

Strip the `export` keyword from those declarations. Two guards:

- **Skip `.test.ts` files.** Tests are entries; their exports are reported but harmless.
- **Never demote a destructured declaration.** `export const { a, b } = createThing()` cannot lose
  `export` for one member, and knip reports members individually. Restore the keyword and tag the
  declaration `@knipignore` with a comment saying the members are destructured together.

Leave the flag at `false` in the committed config so the rule holds for new code, and write it
into the project's own rules file, e.g.:

> Export only what another file imports. A helper used solely inside its own module stays
> unexported. A barrel is justified only when it carries a directory's public API for several
> outside importers — never as a pass-through for a single file, and always named re-exports
> rather than `export *`.

## Verification gate

After every phase, all of it, in this order — a later step catches what an earlier one cannot:

```bash
<formatter> check --write .   # then read what it refused to fix
<typecheck across all workspaces>
<tests in every workspace that has them>
<a real production build>
<knip>                        # deletions expose the next layer
```

Typecheck alone is not enough: it passes on a deleted package entry point, and it cannot see a
bundler boundary.
