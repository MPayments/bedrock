import { inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "./schema";

export interface RequisiteQueryRecord {
  id: string;
  ownerType: "organization" | "counterparty";
  organizationId: string | null;
  counterpartyId: string | null;
  label: string;
}

export interface RequisitesQueries {
  listRequisitesById: (ids: string[]) => Promise<RequisiteQueryRecord[]>;
  listLabelsById: (ids: string[]) => Promise<Map<string, string>>;
}

export function createRequisitesQueries(input: {
  db: Queryable;
}): RequisitesQueries {
  const { db } = input;

  async function listRequisitesById(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        id: schema.requisites.id,
        ownerType: schema.requisites.ownerType,
        organizationId: schema.requisites.organizationId,
        counterpartyId: schema.requisites.counterpartyId,
        label: schema.requisites.label,
      })
      .from(schema.requisites)
      .where(inArray(schema.requisites.id, uniqueIds));

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      organizationId: row.organizationId,
      counterpartyId: row.counterpartyId,
      label: row.label,
    }));
  }

  return {
    listRequisitesById,
    async listLabelsById(ids: string[]) {
      const rows = await listRequisitesById(ids);
      return new Map(rows.map((row) => [row.id, row.label]));
    },
  };
}
