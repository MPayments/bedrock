"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Debounces a callback so rapid consecutive calls coalesce into a single
 * invocation that fires `delayMs` after the last call.
 *
 * Returns a stable function with a `flush` method that fires any pending
 * invocation immediately (useful on unmount or form submit), and a `cancel`
 * method that drops any pending invocation.
 *
 * The debounced function always calls the latest `callback` — updates to the
 * callback do not reset the timer, so in-flight debouncing stays consistent.
 */
export interface DebouncedCallback<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
}

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): DebouncedCallback<TArgs> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingArgsRef.current = null;
    };
  }, []);

  return useMemo(() => {
    const debounced = ((...args: TArgs) => {
      pendingArgsRef.current = args;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const queued = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (queued) {
          callbackRef.current(...queued);
        }
      }, delayMs);
    }) as DebouncedCallback<TArgs>;

    debounced.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingArgsRef.current = null;
    };

    debounced.flush = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const queued = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (queued) {
        callbackRef.current(...queued);
      }
    };

    return debounced;
  }, [delayMs]);
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

