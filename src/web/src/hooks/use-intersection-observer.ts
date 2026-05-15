import { useEffect, useRef, type RefObject } from "react";

interface UseIntersectionObserverOptions {
  /** Scrollable ancestor element. Defaults to the browser viewport when omitted. */
  root?: RefObject<Element | null>;
  /** Margin around the root (CSS margin syntax, e.g. `"200px 0px 0px 0px"`). */
  rootMargin?: string;
  /** Visibility ratio(s) that trigger the callback. */
  threshold?: number | number[];
  /** When `false`, the observer is disconnected and the callback won't fire. */
  enabled?: boolean;
}

/**
 * Calls `onIntersect` whenever the target element enters the root viewport.
 *
 * Returns a ref to attach to the target element. The callback is kept in a
 * ref so it can be updated without re-creating the observer.
 *
 * @example
 * ```tsx
 * const sentinelRef = useIntersectionObserver(loadMore, {
 *   root: scrollContainerRef,
 *   rootMargin: "200px 0px 0px 0px",
 *   enabled: hasMore,
 * });
 * return <div ref={sentinelRef} />;
 * ```
 */
export function useIntersectionObserver(
  onIntersect: () => void,
  options: UseIntersectionObserverOptions = {},
): RefObject<HTMLDivElement | null> {
  const { root, rootMargin, threshold, enabled = true } = options;

  const targetRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);

  useEffect(() => {
    callbackRef.current = onIntersect;
  });

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        root: root?.current ?? null,
        rootMargin,
        threshold,
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold, enabled]);

  return targetRef;
}
