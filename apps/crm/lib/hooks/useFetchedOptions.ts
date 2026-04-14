"use client";

import * as React from "react";

interface UseFetchedOptionsParams<T> {
  fetcher: () => Promise<T[]>;
  open: boolean;
  value: string | undefined;
}

interface UseFetchedOptionsResult<T> {
  items: T[];
  loading: boolean;
}

export function useFetchedOptions<T>({
  fetcher,
  open,
  value,
}: UseFetchedOptionsParams<T>): UseFetchedOptionsResult<T> {
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!(open || (value && items.length === 0))) return;

    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) console.error("useFetchedOptions error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, value, items.length, fetcher]);

  return { items, loading };
}
