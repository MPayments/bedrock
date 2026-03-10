import { eq } from "drizzle-orm";

import type { RequisitesServiceContext } from "../context";
import { RequisiteBindingNotFoundError, RequisiteBindingOwnerTypeError, RequisiteNotFoundError } from "../errors";
import { schema } from "../schema";
import type { RequisiteAccountingBinding } from "../validation";

export function createGetRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { db } = context;

  return async function getRequisiteAccountingBinding(
    requisiteId: string,
  ): Promise<RequisiteAccountingBinding> {
    const [row] = await db
      .select({
        requisiteId: schema.requisites.id,
        ownerType: schema.requisites.ownerType,
        organizationId: schema.requisites.organizationId,
        bookId: schema.requisiteAccountingBindings.bookId,
        bookAccountInstanceId: schema.requisiteAccountingBindings.bookAccountInstanceId,
        postingAccountNo: schema.requisiteAccountingBindings.postingAccountNo,
        createdAt: schema.requisiteAccountingBindings.createdAt,
        updatedAt: schema.requisiteAccountingBindings.updatedAt,
      })
      .from(schema.requisites)
      .leftJoin(
        schema.requisiteAccountingBindings,
        eq(schema.requisiteAccountingBindings.requisiteId, schema.requisites.id),
      )
      .where(eq(schema.requisites.id, requisiteId))
      .limit(1);

    if (!row) {
      throw new RequisiteNotFoundError(requisiteId);
    }

    if (row.ownerType !== "organization" || !row.organizationId) {
      throw new RequisiteBindingOwnerTypeError(requisiteId);
    }

    if (!row.bookId || !row.bookAccountInstanceId || !row.postingAccountNo || !row.createdAt || !row.updatedAt) {
      throw new RequisiteBindingNotFoundError(requisiteId);
    }

    return {
      requisiteId: row.requisiteId,
      organizationId: row.organizationId,
      bookId: row.bookId,
      bookAccountInstanceId: row.bookAccountInstanceId,
      postingAccountNo: row.postingAccountNo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };
}
