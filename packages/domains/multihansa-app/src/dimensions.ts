import { inArray } from "drizzle-orm";

import { schema as documentsSchema } from "@bedrock/documents/schema";
import { isUuidLike } from "@bedrock/kernel";
import {
  createDimensionRegistry,
  type DimensionRegistry,
} from "@bedrock/registers";

import { schema as counterpartiesSchema } from "@multihansa/counterparties/schema";
import { schema as customersSchema } from "@multihansa/customers/schema";
import { schema as requisitesSchema } from "@multihansa/requisites/schema";

const schema = {
  ...counterpartiesSchema,
  ...customersSchema,
  ...documentsSchema,
  ...requisitesSchema,
};

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

export function createMultihansaDimensionRegistry(): DimensionRegistry {
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
