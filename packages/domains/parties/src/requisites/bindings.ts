import { eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/common/sql/ports";
import { ACCOUNT_NO } from "@bedrock/finance/accounting";
import { ensureBookAccountInstanceTx } from "@bedrock/finance/ledger";

import { ensureOrganizationDefaultBookIdTx } from "@multihansa/parties/organizations/default-book";

import { RequisiteBindingNotFoundError, RequisiteBindingOwnerTypeError, RequisiteNotFoundError } from "./errors";
import { schema } from "./schema";

export async function ensureRequisiteAccountingBindingTx(
  tx: Transaction,
  input: {
    requisiteId: string;
    postingAccountNo?: string;
  },
) {
  const [requisite] = await tx
    .select({
      id: schema.requisites.id,
      ownerType: schema.requisites.ownerType,
      organizationId: schema.requisites.organizationId,
      currencyCode: schema.currencies.code,
    })
    .from(schema.requisites)
    .innerJoin(
      schema.currencies,
      eq(schema.currencies.id, schema.requisites.currencyId),
    )
    .where(eq(schema.requisites.id, input.requisiteId))
    .limit(1);

  if (!requisite) {
    throw new RequisiteNotFoundError(input.requisiteId);
  }

  if (requisite.ownerType !== "organization" || !requisite.organizationId) {
    throw new RequisiteBindingOwnerTypeError(input.requisiteId);
  }

  const bookId = await ensureOrganizationDefaultBookIdTx(
    tx,
    requisite.organizationId,
  );
  const postingAccountNo = input.postingAccountNo ?? ACCOUNT_NO.BANK;
  const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(tx, {
    bookId,
    accountNo: postingAccountNo,
    currency: requisite.currencyCode,
    dimensions: {},
  });

  await tx
    .insert(schema.requisiteAccountingBindings)
    .values({
      requisiteId: requisite.id,
      bookId,
      bookAccountInstanceId,
      postingAccountNo,
    })
    .onConflictDoUpdate({
      target: schema.requisiteAccountingBindings.requisiteId,
      set: {
        bookId,
        bookAccountInstanceId,
        postingAccountNo,
      },
    });

  const [binding] = await tx
    .select()
    .from(schema.requisiteAccountingBindings)
    .where(eq(schema.requisiteAccountingBindings.requisiteId, requisite.id))
    .limit(1);

  if (!binding) {
    throw new RequisiteBindingNotFoundError(requisite.id);
  }

  return {
    ...binding,
    organizationId: requisite.organizationId,
  };
}
