import { eq, inArray } from "drizzle-orm";

import type { RequisitesServiceContext } from "../context";
import { RequisiteBindingNotFoundError, RequisiteNotFoundError } from "../errors";
import { schema } from "../schema";

export function createResolveRequisiteBindingsHandler(
  context: RequisitesServiceContext,
) {
  const { db, log } = context;

  return async function resolveRequisiteBindings(input: { requisiteIds: string[] }) {
    const uniqueIds = [...new Set(input.requisiteIds)];

    const rows = await db
      .select({
        requisiteId: schema.requisites.id,
        ownerType: schema.requisites.ownerType,
        organizationId: schema.requisites.organizationId,
        bookId: schema.requisiteAccountingBindings.bookId,
        bookAccountInstanceId: schema.requisiteAccountingBindings.bookAccountInstanceId,
        currencyId: schema.requisites.currencyId,
        currencyCode: schema.currencies.code,
        postingAccountNo: schema.requisiteAccountingBindings.postingAccountNo,
      })
      .from(schema.requisites)
      .innerJoin(
        schema.requisiteAccountingBindings,
        eq(schema.requisiteAccountingBindings.requisiteId, schema.requisites.id),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.currencies.id, schema.requisites.currencyId),
      )
      .where(inArray(schema.requisites.id, uniqueIds));

    if (rows.length !== uniqueIds.length) {
      const found = new Set(rows.map((row) => row.requisiteId));
      const missingId = uniqueIds.find((id) => !found.has(id)) ?? uniqueIds[0];
      throw new RequisiteNotFoundError(missingId!);
    }

    const byId = new Map(
      rows.map((row) => [
        row.requisiteId,
        row.ownerType === "organization" && row.organizationId
          ? {
              requisiteId: row.requisiteId,
              organizationId: row.organizationId,
              bookId: row.bookId,
              bookAccountInstanceId: row.bookAccountInstanceId,
              currencyId: row.currencyId,
              currencyCode: row.currencyCode,
              postingAccountNo: row.postingAccountNo,
            }
          : null,
      ]),
    );

    for (const id of uniqueIds) {
      if (!byId.has(id)) {
        throw new RequisiteNotFoundError(id);
      }
      if (!byId.get(id)) {
        throw new RequisiteBindingNotFoundError(id);
      }
    }

    log.debug("Resolved requisite bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) => byId.get(id)!);
  };
}
