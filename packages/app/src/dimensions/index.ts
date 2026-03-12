import { inArray } from "drizzle-orm";

import { schema as counterpartiesSchema } from "@bedrock/app/counterparties/schema";
import { schema as customersSchema } from "@bedrock/app/customers/schema";
import { schema as documentsSchema } from "@bedrock/app/documents/schema";
import { type Dimensions } from "@bedrock/app/ledger/schema";
import { schema as requisitesSchema } from "@bedrock/app/requisites/schema";
import { isUuidLike } from "@bedrock/common";
import type { Database } from "@bedrock/common/db/types";

const schema = {
  ...counterpartiesSchema,
  ...customersSchema,
  ...documentsSchema,
  ...requisitesSchema,
};

export type DimensionLabelResolver = (input: {
  db: Database;
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
    db: Database;
    valuesByKey: Record<string, string[]>;
  }) => Promise<Record<string, Record<string, string>>>;
  resolveLabelsFromDimensionRecords: (input: {
    db: Database;
    records: (Dimensions | null | undefined)[];
  }) => Promise<Record<string, Record<string, string>>>;
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
    db: Database;
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

      const labels = await entry.resolveLabels({
        db: input.db,
        values: unresolved,
      });

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
    db: Database;
    records: (Dimensions | null | undefined)[];
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
      db: input.db,
      valuesByKey,
    });
  }

  return {
    resolveLabels,
    resolveLabelsFromDimensionRecords,
  };
}

export function createBedrockDimensionRegistry(): DimensionRegistry {
  return createDimensionRegistry([
    {
      key: "counterpartyId",
      resolveLabels: async ({ db, values }) => {
        const rows = await db
          .select({
            id: schema.counterparties.id,
            label: schema.counterparties.shortName,
          })
          .from(schema.counterparties)
          .where(inArray(schema.counterparties.id, uniqueStrings(values)));

        return new Map(rows.map((row) => [row.id, row.label]));
      },
    },
    {
      key: "organizationRequisiteId",
      resolveLabels: async ({ db, values }) => {
        const rows = await db
          .select({
            id: schema.requisites.id,
            label: schema.requisites.label,
          })
          .from(schema.requisites)
          .where(inArray(schema.requisites.id, uniqueStrings(values)));

        return new Map(rows.map((row) => [row.id, row.label]));
      },
    },
    {
      key: "customerId",
      resolveLabels: async ({ db, values }) => {
        const rows = await db
          .select({
            id: schema.customers.id,
            label: schema.customers.displayName,
          })
          .from(schema.customers)
          .where(inArray(schema.customers.id, uniqueStrings(values)));

        return new Map(rows.map((row) => [row.id, row.label]));
      },
    },
    {
      key: "orderId",
      resolveLabels: async ({ db, values }) => {
        const ids = uniqueStrings(values).filter(isUuidLike);
        if (ids.length === 0) {
          return new Map();
        }

        const rows = await db
          .select({
            id: schema.documents.id,
            docNo: schema.documents.docNo,
            docType: schema.documents.docType,
            title: schema.documents.title,
          })
          .from(schema.documents)
          .where(inArray(schema.documents.id, ids));

        return new Map(
          rows.map((row) => [
            row.id,
            `${row.docType} ${row.docNo}${row.title ? ` · ${row.title}` : ""}`,
          ]),
        );
      },
    },
  ]);
}
