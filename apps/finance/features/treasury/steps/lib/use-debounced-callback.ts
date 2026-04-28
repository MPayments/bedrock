export interface DebouncedCallback<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Non-React variant used by pure tests. Returns the same `(debounced, cancel,
 * flush)` triple but without the hook wrappers.
 */
export function createDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): DebouncedCallback<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TArgs | null = null;

  const debounced = ((...args: TArgs) => {
    pending = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const queued = pending;
      pending = null;
      if (queued) callback(...queued);
    }, delayMs);
  }) as DebouncedCallback<TArgs>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  debounced.flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    const queued = pending;
    pending = null;
    if (queued) callback(...queued);
  };

  return debounced;
}
