"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface UseSearchParamOptions {
  /** Returned when the param is absent from the URL. */
  defaultValue?: string;
}

interface UseSearchParamNumberOptions {
  /** Returned when the param is absent or fails to parse as a finite number. */
  defaultValue?: number;
}

type Setter<T> = (next: T | null) => void;

function buildHref(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Two-way binding between a React state value and a single URL search
 * parameter. Reads via Next.js's `useSearchParams()` and writes via
 * `router.replace()` so the URL becomes the source of truth (refresh,
 * share, back-button all work).
 *
 * Pass `null` or `""` to the setter to remove the param entirely.
 * Navigation never scrolls the page.
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useSearchParam("search");
 * // <input value={search ?? ""} onChange={e => setSearch(e.target.value)} />
 * ```
 *
 * @param key      Search-param name.
 * @param options  `defaultValue` is returned when the param is missing.
 * @returns A `[value, setValue]` tuple, React-state style.
 */
export function useSearchParam(
  key: string,
  options: UseSearchParamOptions = {},
): [string | null, Setter<string>] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw !== null ? raw : (options.defaultValue ?? null);

  const setValue: Setter<string> = (next) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null || next === "") {
      params.delete(key);
    } else {
      params.set(key, next);
    }
    const href = buildHref(window.location.pathname, params) as Parameters<
      typeof router.replace
    >[0];
    router.replace(href, { scroll: false });
  };

  return [value, setValue];
}

/**
 * Number-typed sibling of {@link useSearchParam}. Parses the URL param as a
 * finite number on read and stringifies it on write. Pass `null` or `NaN`
 * to the setter to remove the param.
 *
 * @example
 * ```tsx
 * const [matchMin, setMatchMin] = useSearchParamNumber("matchMin");
 * ```
 *
 * @param key      Search-param name.
 * @param options  `defaultValue` is returned when the param is missing or
 *                 fails to parse.
 */
export function useSearchParamNumber(
  key: string,
  options: UseSearchParamNumberOptions = {},
): [number | null, Setter<number>] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  let value: number | null = options.defaultValue ?? null;
  if (raw !== null) {
    const parsed = Number(raw);
    value = Number.isFinite(parsed) ? parsed : (options.defaultValue ?? null);
  }

  const setValue: Setter<number> = (next) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null || Number.isNaN(next)) {
      params.delete(key);
    } else {
      params.set(key, String(next));
    }
    const href = buildHref(window.location.pathname, params) as Parameters<
      typeof router.replace
    >[0];
    router.replace(href, { scroll: false });
  };

  return [value, setValue];
}
