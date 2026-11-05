/** `onActive` runs on the first subscriber and tears down on the last: idle stores cost nothing. */
export class ExternalStore<T> {
  private readonly listeners = new Set<() => void>();
  private teardown: (() => void) | null = null;

  constructor(
    private value: T,
    private readonly onActive?: () => () => void,
  ) {
    // `useSyncExternalStore` re-subscribes on any new function identity, so these must stay stable.
    this.subscribe = this.subscribe.bind(this);
    this.get = this.get.bind(this);
  }

  get(): T {
    return this.value;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.teardown = this.onActive?.() ?? null;
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.teardown?.();
        this.teardown = null;
      }
    };
  }

  /** An `Object.is`-equal write is a no-op, so callers can be lazy. */
  set(next: T): void {
    if (Object.is(next, this.value)) {
      return;
    }
    this.value = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  update(next: (current: T) => T): void {
    this.set(next(this.value));
  }
}
