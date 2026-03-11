export function freezeObject<T extends object>(value: T): T {
  return Object.freeze(value);
}

export function cloneReadonlyArray<T>(
  value: readonly T[] | undefined,
): readonly T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return freezeObject([...value]);
}

export function cloneReadonlyRecord<T extends Record<string, unknown> | undefined>(
  value: T,
): T {
  if (value === undefined) {
    return value;
  }

  return freezeObject({ ...value }) as T;
}
