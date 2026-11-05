type FlagValue = string | number | boolean | null | undefined;

interface BuildCliArgsOptions {
  /** Empty entries are dropped. */
  positional?: ReadonlyArray<string | number | null | undefined>;
  /** `true` is a bare `--key`; falsy values are skipped. */
  flags?: Record<string, FlagValue>;
}

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
