import { eq } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/core/accounting";
import { ensureBookAccountInstanceTx } from "@bedrock/core/ledger";
import type { Transaction } from "@bedrock/kernel/db/types";

import { ensureInternalLedgerDefaultBookIdTx } from "../../counterparties/internal/default-book";
import { schema } from "../schema";
import {
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../errors";

export async function ensureOrganizationRequisiteBindingTx(
  tx: Transaction,
  input: {
    requisiteId: string;
    postingAccountNo?: string;
  },
) {
  const [requisite] = await tx
    .select({
      id: schema.organizationRequisites.id,
      organizationId: schema.organizationRequisites.organizationId,
      currencyCode: schema.currencies.code,
    })
    .from(schema.organizationRequisites)
    .innerJoin(
      schema.currencies,
      eq(schema.currencies.id, schema.organizationRequisites.currencyId),
    )
    .where(eq(schema.organizationRequisites.id, input.requisiteId))
    .limit(1);

  if (!requisite) {
    throw new OrganizationRequisiteNotFoundError(input.requisiteId);
  }

  const bookId = await ensureInternalLedgerDefaultBookIdTx(
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
    .insert(schema.organizationRequisiteBindings)
    .values({
      requisiteId: requisite.id,
      bookId,
      bookAccountInstanceId,
      postingAccountNo,
    })
    .onConflictDoUpdate({
      target: schema.organizationRequisiteBindings.requisiteId,
      set: {
        bookId,
        bookAccountInstanceId,
        postingAccountNo,
      },
    });

  const [binding] = await tx
    .select()
    .from(schema.organizationRequisiteBindings)
    .where(eq(schema.organizationRequisiteBindings.requisiteId, requisite.id))
    .limit(1);

  if (!binding) {
    throw new OrganizationRequisiteBindingNotFoundError(requisite.id);
  }

  return binding;
}
