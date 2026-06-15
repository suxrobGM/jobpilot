type FlagValue = string | number | boolean | null | undefined;

interface BuildCliArgsOptions {
  /** Positional args, in order. `null`/`undefined`/`""` entries are dropped. */
  positional?: ReadonlyArray<string | number | null | undefined>;
  /** Flag map. `--key value` for strings/numbers, `--key` for `true`. Falsy values (`false`/`null`/`undefined`/`""`) are skipped. */
  flags?: Record<string, FlagValue>;
}

/**
 * Build a CLI-style argument string from positional parts and an optional
 * flag map. Used to construct skill invocation arguments.
 *
 * Example:
 *   buildCliArgs({ positional: ["senior react"], flags: { board: "linkedin.com", "max-apps": 5 } })
 *   // => "senior react --board linkedin.com --max-apps 5"
 */
export function buildCliArgs(options: BuildCliArgsOptions): string {
  const parts: string[] = [];

  for (const p of options.positional ?? []) {
    if (p == null) {
      continue;
    }
    const str = String(p);
    if (str !== "") {
      parts.push(str);
    }
  }

  for (const [key, value] of Object.entries(options.flags ?? {})) {
    if (value == null || value === false || value === "") {
      continue;
    }
    if (value === true) {
      parts.push(`--${key}`);
    } else {
      parts.push(`--${key} ${value}`);
    }
  }

  return parts.join(" ");
}
