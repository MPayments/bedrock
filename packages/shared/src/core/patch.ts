export function resolvePatchValue<T>(current: T, next: T | undefined): T {
  return next === undefined ? current : next;
}

export function applyPatch<T extends object>(
  current: T,
  patch: Partial<T>,
): T {
  const next = { ...current };

  for (const [key, value] of Object.entries(patch) as [
    keyof T,
    T[keyof T] | undefined,
  ][]) {
    if (value !== undefined) {
      next[key] = value as T[keyof T];
    }
  }

  return next;
}
