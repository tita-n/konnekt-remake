/**
 * A trailing-edge debouncer used by the composer. Scheduling replaces the
 * pending work, flush runs it immediately and cancel drops it. Kept dependency
 * free so its timing can be unit tested without a DOM.
 */
export function createDebouncedTask<T>(task: (value: T) => void | Promise<void>, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  }

  function schedule(value: T) {
    pending = value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const current = pending;
      pending = null;
      if (current !== null) void task(current);
    }, delayMs);
  }

  function flush() {
    if (!timer || pending === null) return;
    clearTimeout(timer);
    timer = null;
    const current = pending;
    pending = null;
    void task(current);
  }

  return { schedule, flush, cancel };
}
