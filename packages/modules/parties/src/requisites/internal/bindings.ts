import { eq } from "drizzle-orm";

import { ensureRequisiteAccountingBindingTx as ensurePartiesLedgerBindingTx } from "@bedrock/parties-ledger";
import type { Transaction } from "@bedrock/kernel/db/types";
import {
  RequisiteBindingNotFoundError,
  RequisiteBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "../errors";
import { schema } from "../schema";

const DEFAULT_REQUISITE_POSTING_ACCOUNT_NO = "1110";

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

  const postingAccountNo =
    input.postingAccountNo ?? DEFAULT_REQUISITE_POSTING_ACCOUNT_NO;
  const binding = await ensurePartiesLedgerBindingTx(tx, {
    requisiteId: requisite.id,
    organizationId: requisite.organizationId,
    currencyCode: requisite.currencyCode,
    postingAccountNo,
  });

  if (!binding) {
    throw new RequisiteBindingNotFoundError(requisite.id);
  }

  return {
    ...binding,
    organizationId: requisite.organizationId,
  };
}
