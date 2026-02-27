import type { Dimensions } from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
  tbTransferIdForOperation,
} from "@bedrock/kernel";

import {
  OPERATION_TRANSFER_TYPE,
  type IntentLine,
} from "../../types";

async function ensureBookAccountInstance(
  tx: Transaction,
  input: {
    bookOrgId: string;
    accountNo: string;
    currency: string;
    dimensions: Dimensions;
  },
) {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const expectedTbAccountId = tbBookAccountInstanceIdFor(
    input.bookOrgId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

  const inserted = await tx
    .insert(schema.bookAccountInstances)
    .values({
      bookOrgId: input.bookOrgId,
      accountNo: input.accountNo,
      currency: input.currency,
      dimensions: input.dimensions,
      dimensionsHash,
      tbLedger,
      tbAccountId: expectedTbAccountId,
    })
    .onConflictDoUpdate({
      target: [
        schema.bookAccountInstances.bookOrgId,
        schema.bookAccountInstances.accountNo,
        schema.bookAccountInstances.currency,
        schema.bookAccountInstances.dimensionsHash,
      ],
      set: {
        tbLedger,
        tbAccountId: expectedTbAccountId,
        dimensions: input.dimensions,
      },
    })
    .returning({
      id: schema.bookAccountInstances.id,
      tbLedger: schema.bookAccountInstances.tbLedger,
      tbAccountId: schema.bookAccountInstances.tbAccountId,
    });

  const existing = inserted[0];
  if (!existing) {
    throw new Error(
      `book account instance upsert failed unexpectedly for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  if (
    existing.tbLedger !== tbLedger ||
    existing.tbAccountId !== expectedTbAccountId
  ) {
    throw new Error(
      `book_account_instance invariant mismatch for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  return existing;
}

export async function buildPlanRows(input: {
  tx: Transaction;
  operationId: string;
  bookOrgId: string;
  lines: IntentLine[];
  linkedFlags: boolean[];
  validateCreateLine: (
    line: Extract<IntentLine, { type: typeof OPERATION_TRANSFER_TYPE.CREATE }>,
  ) => Promise<void>;
}): Promise<{
  postingRows: (typeof schema.postings.$inferInsert)[];
  tbPlanRows: (typeof schema.tbTransferPlans.$inferInsert)[];
  pendingTransferIdsByRef: Map<string, bigint>;
}> {
  const { tx, operationId, bookOrgId, lines, linkedFlags, validateCreateLine } =
    input;

  const pendingTransferIdsByRef = new Map<string, bigint>();
  const postingRows: (typeof schema.postings.$inferInsert)[] = [];
  const tbPlanRows: (typeof schema.tbTransferPlans.$inferInsert)[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
      await validateCreateLine(line);

      const [debitInstance, creditInstance] = await Promise.all([
        ensureBookAccountInstance(tx, {
          bookOrgId,
          accountNo: line.debit.accountNo,
          currency: line.debit.currency,
          dimensions: line.debit.dimensions,
        }),
        ensureBookAccountInstance(tx, {
          bookOrgId,
          accountNo: line.credit.accountNo,
          currency: line.credit.currency,
          dimensions: line.credit.dimensions,
        }),
      ]);

      postingRows.push({
        operationId,
        lineNo,
        bookOrgId,
        debitInstanceId: debitInstance.id,
        creditInstanceId: creditInstance.id,
        postingCode: line.postingCode,
        currency: line.debit.currency,
        amountMinor: line.amountMinor,
        memo: line.memo ?? null,
        context: line.context ?? null,
      });

      if (line.pending) {
        pendingTransferIdsByRef.set(
          line.pending.ref ?? line.planRef,
          transferId,
        );
      }

      tbPlanRows.push({
        operationId,
        lineNo,
        type: OPERATION_TRANSFER_TYPE.CREATE,
        transferId,
        debitTbAccountId: debitInstance.tbAccountId,
        creditTbAccountId: creditInstance.tbAccountId,
        tbLedger: debitInstance.tbLedger,
        amount: line.amountMinor,
        code: line.code ?? 1,
        pendingRef: line.pending?.ref ?? null,
        pendingId: null,
        isLinked: linkedFlags[i]!,
        isPending: !!line.pending,
        timeoutSeconds: line.pending?.timeoutSeconds ?? 0,
        status: "pending",
      });
      continue;
    }

    if (line.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
      tbPlanRows.push({
        operationId,
        lineNo,
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        transferId,
        debitTbAccountId: null,
        creditTbAccountId: null,
        tbLedger: tbLedgerForCurrency(line.currency),
        amount: line.amount ?? 0n,
        code: line.code ?? 0,
        pendingRef: null,
        pendingId: line.pendingId,
        isLinked: linkedFlags[i]!,
        isPending: false,
        timeoutSeconds: 0,
        status: "pending",
      });
      continue;
    }

    tbPlanRows.push({
      operationId,
      lineNo,
      type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      transferId,
      debitTbAccountId: null,
      creditTbAccountId: null,
      tbLedger: tbLedgerForCurrency(line.currency),
      amount: 0n,
      code: line.code ?? 0,
      pendingRef: null,
      pendingId: line.pendingId,
      isLinked: linkedFlags[i]!,
      isPending: false,
      timeoutSeconds: 0,
      status: "pending",
    });
  }

  return { postingRows, tbPlanRows, pendingTransferIdsByRef };
}
