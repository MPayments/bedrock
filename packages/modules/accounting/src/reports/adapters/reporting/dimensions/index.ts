import type {
  AccountingCounterpartiesQueryPort,
  AccountingCustomersQueryPort,
  AccountingOrganizationsQueryPort,
  AccountingRequisitesQueryPort,
} from "../party-query-ports";

export type DimensionLabelResolver = (input: {
  values: string[];
}) => Promise<Map<string, string>>;

export interface DimensionRegistryEntry {
  key: string;
  resolveLabels?: DimensionLabelResolver;
}

interface CacheEntry {
  label: string | null;
  expiresAt: number;
}

export interface DimensionRegistry {
  resolveLabels: (input: {
    valuesByKey: Record<string, string[]>;
  }) => Promise<Record<string, Record<string, string>>>;
  resolveLabelsFromDimensionRecords: (input: {
    records: (Record<string, string> | null | undefined)[];
  }) => Promise<Record<string, Record<string, string>>>;
}

export interface DimensionDocumentsReadModel {
  listDocumentLabelsById: (ids: string[]) => Promise<Map<string, string>>;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

export function createDimensionRegistry(
  entries: DimensionRegistryEntry[],
  options?: {
    ttlMs?: number;
    negativeTtlMs?: number;
  },
): DimensionRegistry {
  const ttlMs = options?.ttlMs ?? 60_000;
  const negativeTtlMs = options?.negativeTtlMs ?? 10_000;
  const entryMap = new Map(entries.map((entry) => [entry.key, entry]));
  const cache = new Map<string, CacheEntry>();

  function readCache(key: string): string | null | undefined {
    const cached = cache.get(key);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt < Date.now()) {
      cache.delete(key);
      return undefined;
    }

    return cached.label;
  }

  function writeCache(key: string, label: string | null) {
    cache.set(key, {
      label,
      expiresAt: Date.now() + (label === null ? negativeTtlMs : ttlMs),
    });
  }

  async function resolveLabels(input: {
    valuesByKey: Record<string, string[]>;
  }) {
    const resolved: Record<string, Record<string, string>> = {};

    for (const [dimensionKey, rawValues] of Object.entries(input.valuesByKey)) {
      const entry = entryMap.get(dimensionKey);
      if (!entry?.resolveLabels) {
        continue;
      }

      const values = uniqueStrings(rawValues);
      if (values.length === 0) {
        continue;
      }

      const unresolved: string[] = [];
      for (const value of values) {
        const cached = readCache(`${dimensionKey}:${value}`);
        if (typeof cached === "string") {
          resolved[dimensionKey] ??= {};
          resolved[dimensionKey]![value] = cached;
          continue;
        }

        if (cached === null) {
          continue;
        }

        unresolved.push(value);
      }

      if (unresolved.length === 0) {
        continue;
      }

      const labels = await entry.resolveLabels({ values: unresolved });

      for (const value of unresolved) {
        const label = labels.get(value) ?? null;
        writeCache(`${dimensionKey}:${value}`, label);
        if (label) {
          resolved[dimensionKey] ??= {};
          resolved[dimensionKey]![value] = label;
        }
      }
    }

    return resolved;
  }

  async function resolveLabelsFromDimensionRecords(input: {
    records: (Record<string, string> | null | undefined)[];
  }) {
    const valuesByKey: Record<string, string[]> = {};

    for (const record of input.records) {
      if (!record) {
        continue;
      }

      for (const [key, value] of Object.entries(record)) {
        if (typeof value !== "string" || value.length === 0) {
          continue;
        }

        valuesByKey[key] ??= [];
        valuesByKey[key]!.push(value);
      }
    }

    return resolveLabels({
      valuesByKey,
    });
  }

  return {
    resolveLabels,
    resolveLabelsFromDimensionRecords,
  };
}

export function createBedrockDimensionRegistry(input: {
  counterpartiesQueries: AccountingCounterpartiesQueryPort;
  customersQueries: AccountingCustomersQueryPort;
  organizationsQueries: AccountingOrganizationsQueryPort;
  requisitesQueries: AccountingRequisitesQueryPort;
  documentsReadModel?: DimensionDocumentsReadModel;
}): DimensionRegistry {
  const {
    counterpartiesQueries,
    customersQueries,
    requisitesQueries,
    documentsReadModel,
  } = input;

  return createDimensionRegistry([
    {
      key: "counterpartyId",
      resolveLabels: ({ values }) =>
        counterpartiesQueries.listShortNamesById(values),
    },
    {
      key: "organizationRequisiteId",
      resolveLabels: ({ values }) => requisitesQueries.listLabelsById(values),
    },
    {
      key: "customerId",
      resolveLabels: ({ values }) =>
        customersQueries.listDisplayNamesById(values),
    },
    {
      key: "orderId",
      resolveLabels: async ({ values }) =>
        documentsReadModel?.listDocumentLabelsById(values) ?? new Map(),
    },
  ]);
}
