import type { WorkerDescriptor } from "./types";

function normalizePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer, got ${value}`);
  }
}

function validateDescriptors(
  descriptors: readonly WorkerDescriptor[],
): readonly WorkerDescriptor[] {
  const ids = new Set<string>();
  const envKeys = new Set<string>();

  for (const descriptor of descriptors) {
    const id = descriptor.id.trim();
    if (id.length === 0) {
      throw new Error("Worker descriptor id must not be empty");
    }

    const envKey = descriptor.envKey.trim();
    if (envKey.length === 0) {
      throw new Error(`Worker descriptor ${descriptor.id} envKey must not be empty`);
    }

    normalizePositiveInteger(
      descriptor.defaultIntervalMs,
      `Worker descriptor ${descriptor.id} defaultIntervalMs`,
    );

    if (ids.has(id)) {
      throw new Error(`Duplicate worker descriptor id: ${id}`);
    }
    ids.add(id);

    if (envKeys.has(envKey)) {
      throw new Error(`Duplicate worker descriptor envKey: ${envKey}`);
    }
    envKeys.add(envKey);
  }

  return [...descriptors].sort((left, right) => left.id.localeCompare(right.id));
}

export function defineWorkerDescriptor<T extends WorkerDescriptor>(
  input: T,
): T {
  validateDescriptors([input]);
  return input;
}

export function listWorkerIds(
  descriptors: readonly WorkerDescriptor[],
): string[] {
  return validateDescriptors(descriptors).map((descriptor) => descriptor.id);
}

export function resolveWorkerIntervals(input: {
  descriptors: readonly WorkerDescriptor[];
  env: Record<string, string | undefined>;
  overrides?: Record<string, number | undefined>;
}): Record<string, number> {
  const intervals: Record<string, number> = {};

  for (const descriptor of validateDescriptors(input.descriptors)) {
    const rawValue =
      input.overrides?.[descriptor.id] ??
      (input.env[descriptor.envKey] === undefined
        ? descriptor.defaultIntervalMs
        : Number(input.env[descriptor.envKey]));

    normalizePositiveInteger(
      rawValue,
      `Worker interval for ${descriptor.id}`,
    );
    intervals[descriptor.id] = rawValue;
  }

  return intervals;
}
