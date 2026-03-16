import { WORKER_CATALOG } from "./catalog";

export function listAvailableWorkerIds(): string[] {
  return WORKER_CATALOG.map((entry) => entry.id);
}

export function parseSelectedWorkerIds(
  input: readonly string[],
): string[] | undefined {
  const availableWorkerIds = listAvailableWorkerIds();
  const requested = input
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (requested.length === 0 || requested.includes("all")) {
    return undefined;
  }

  const uniqueRequested = [...new Set(requested)];
  const unknown = uniqueRequested.filter(
    (workerId) => !availableWorkerIds.includes(workerId),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown worker ids: ${unknown.join(", ")}. Available: ${availableWorkerIds.join(", ")}`,
    );
  }

  return uniqueRequested;
}
