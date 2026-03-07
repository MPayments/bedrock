import { eq, inArray } from "drizzle-orm";

import { schema } from "../schema";
import type { OrganizationRequisitesServiceContext } from "../internal/context";
import {
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../errors";

export function createResolveOrganizationRequisiteBindingsHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function resolveOrganizationRequisiteBindings(input: {
    requisiteIds: string[];
  }) {
    const uniqueIds = [...new Set(input.requisiteIds)];

    const rows = await db
      .select({
        requisiteId: schema.organizationRequisites.id,
        organizationId: schema.organizationRequisites.organizationId,
        bookId: schema.organizationRequisiteBindings.bookId,
        bookAccountInstanceId:
          schema.organizationRequisiteBindings.bookAccountInstanceId,
        currencyId: schema.organizationRequisites.currencyId,
        currencyCode: schema.currencies.code,
        postingAccountNo: schema.organizationRequisiteBindings.postingAccountNo,
      })
      .from(schema.organizationRequisites)
      .innerJoin(
        schema.organizationRequisiteBindings,
        eq(
          schema.organizationRequisiteBindings.requisiteId,
          schema.organizationRequisites.id,
        ),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.currencies.id, schema.organizationRequisites.currencyId),
      )
      .where(inArray(schema.organizationRequisites.id, uniqueIds));

    if (rows.length !== uniqueIds.length) {
      const found = new Set(rows.map((row) => row.requisiteId));
      const missingId = uniqueIds.find((id) => !found.has(id)) ?? uniqueIds[0];
      throw new OrganizationRequisiteNotFoundError(missingId!);
    }

    const byId = new Map(
      rows.map((row) => [
        row.requisiteId,
        {
          requisiteId: row.requisiteId,
          organizationId: row.organizationId,
          bookId: row.bookId,
          bookAccountInstanceId: row.bookAccountInstanceId,
          currencyId: row.currencyId,
          currencyCode: row.currencyCode,
          postingAccountNo: row.postingAccountNo,
        },
      ]),
    );

    for (const id of uniqueIds) {
      if (!byId.has(id)) {
        throw new OrganizationRequisiteBindingNotFoundError(id);
      }
    }

    log.debug("Resolved organization requisite bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) => byId.get(id)!);
  };
}
