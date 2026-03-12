import { eq } from "drizzle-orm";

import { ensureBookAccountInstanceTx } from "@bedrock/ledger";
import type { Transaction } from "@bedrock/common/db/types";

import { ensureOrganizationDefaultBookIdTx } from "./default-books";
import { schema } from "./schema";

export async function ensureRequisiteAccountingBindingTx(
  tx: Transaction,
  input: {
    requisiteId: string;
    organizationId: string;
    currencyCode: string;
    postingAccountNo: string;
  },
) {
  const bookId = await ensureOrganizationDefaultBookIdTx(
    tx,
    input.organizationId,
  );
  const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(tx, {
    bookId,
    accountNo: input.postingAccountNo,
    currency: input.currencyCode,
    dimensions: {},
  });

  await tx
    .insert(schema.requisiteAccountingBindings)
    .values({
      requisiteId: input.requisiteId,
      bookId,
      bookAccountInstanceId,
      postingAccountNo: input.postingAccountNo,
    })
    .onConflictDoUpdate({
      target: schema.requisiteAccountingBindings.requisiteId,
      set: {
        bookId,
        bookAccountInstanceId,
        postingAccountNo: input.postingAccountNo,
      },
    });

  const [binding] = await tx
    .select()
    .from(schema.requisiteAccountingBindings)
    .where(eq(schema.requisiteAccountingBindings.requisiteId, input.requisiteId))
    .limit(1);

  if (!binding) {
    throw new Error(
      `Failed to resolve accounting binding for requisite: ${input.requisiteId}`,
    );
  }

  return binding;
}
