import { MemoryCache } from "./memory-cache";
import { describe, expect, it, mock } from "bun:test";

const TTL_MS = 1000;

function cacheWithClock(maxEntries?: number) {
  const clock = { now: 0 };
  const cache = new MemoryCache<string, number>({
    ttlMs: TTL_MS,
    maxEntries,
    now: () => clock.now,
  });
  return { cache, clock };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("MemoryCache", () => {
  it("loads once and serves the cached value within the TTL", async () => {
    const { cache, clock } = cacheWithClock();
    const load = mock(() => Promise.resolve(1));

    expect(await cache.getOrLoad("a", load)).toBe(1);
    clock.now = TTL_MS - 1;
    expect(await cache.getOrLoad("a", load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads once the TTL has passed", async () => {
    const { cache, clock } = cacheWithClock();
    let calls = 0;
    const load = () => Promise.resolve(++calls);

    await cache.getOrLoad("a", load);
    clock.now = TTL_MS;
    expect(await cache.getOrLoad("a", load)).toBe(2);
  });

  it("shares one in-flight load between concurrent misses", async () => {
    const { cache } = cacheWithClock();
    const pending = deferred<number>();
    const load = mock(() => pending.promise);

    const first = cache.getOrLoad("a", load);
    const second = cache.getOrLoad("a", load);
    pending.resolve(7);

    expect(await Promise.all([first, second])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed load", async () => {
    const { cache } = cacheWithClock();

    await expect(cache.getOrLoad("a", () => Promise.reject(new Error("down")))).rejects.toThrow(
      "down",
    );
    expect(cache.size).toBe(0);
    expect(await cache.getOrLoad("a", () => Promise.resolve(1))).toBe(1);
  });

  it("turns a synchronous throw into a rejection", async () => {
    const { cache } = cacheWithClock();
    const load = (): Promise<number> => {
      throw new Error("boom");
    };

    await expect(cache.getOrLoad("a", load)).rejects.toThrow("boom");
    expect(cache.size).toBe(0);
  });

  it("keeps a newer load when an older one for the same key fails late", async () => {
    const { cache, clock } = cacheWithClock();
    const stale = deferred<number>();

    const old = cache.getOrLoad("a", () => stale.promise);
    clock.now = TTL_MS;
    expect(await cache.getOrLoad("a", () => Promise.resolve(2))).toBe(2);
    stale.reject(new Error("late"));
    await old.catch(() => {});

    expect(await cache.getOrLoad("a", () => Promise.resolve(99))).toBe(2);
  });

  it("evicts the least recently used key past maxEntries", async () => {
    const { cache } = cacheWithClock(2);

    await cache.getOrLoad("a", () => Promise.resolve(1));
    await cache.getOrLoad("b", () => Promise.resolve(2));
    await cache.getOrLoad("a", () => Promise.resolve(99));
    await cache.getOrLoad("c", () => Promise.resolve(3));

    expect(cache.size).toBe(2);
    expect(await cache.getOrLoad("a", () => Promise.resolve(99))).toBe(1);
    expect(await cache.getOrLoad("b", () => Promise.resolve(20))).toBe(20);
  });
});
