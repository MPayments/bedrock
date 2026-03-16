export function resolvePatchValue<T>(current: T, next: T | undefined): T {
  return next === undefined ? current : next;
}
