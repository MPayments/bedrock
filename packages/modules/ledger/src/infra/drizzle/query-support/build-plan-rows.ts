import type { Transaction } from "@bedrock/platform/persistence";

import type { LedgerBookAccountsPort } from "../../../application/book-accounts/ports";
import type {
  LedgerPostingInsert,
  LedgerTransferPlanInsert,
} from "../../../application/commit/ports";
import {
  OPERATION_TRANSFER_TYPE,
  type IntentLine,
} from "../../../domain/operation-intent";
import {
  tbLedgerForCurrency,
  tbTransferIdForOperation,
} from "../../../ids";


export async function buildPlanRows(input: {
  tx: Transaction;
  operationId: string;
  lines: IntentLine[];
  linkedFlags: boolean[];
  bookAccounts: LedgerBookAccountsPort;
}): Promise<{
  postingRows: LedgerPostingInsert[];
  tbPlanRows: LedgerTransferPlanInsert[];
  pendingTransferIdsByRef: Map<string, bigint>;
}> {
  const { tx, operationId, lines, linkedFlags, bookAccounts } = input;

  const pendingTransferIdsByRef = new Map<string, bigint>();
  const postingRows: LedgerPostingInsert[] = [];
  const tbPlanRows: LedgerTransferPlanInsert[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
      const [debitInstance, creditInstance] = await Promise.all([
        bookAccounts.ensureBookAccountInstanceTx(tx, {
          bookId: line.bookId,
          accountNo: line.debit.accountNo,
          currency: line.debit.currency,
          dimensions: line.debit.dimensions,
        }),
        bookAccounts.ensureBookAccountInstanceTx(tx, {
          bookId: line.bookId,
          accountNo: line.credit.accountNo,
          currency: line.credit.currency,
          dimensions: line.credit.dimensions,
        }),
      ]);

      postingRows.push({
        operationId,
        lineNo,
        bookId: line.bookId,
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
        isLinked: linkedFlags[index]!,
        isPending: Boolean(line.pending),
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
        isLinked: linkedFlags[index]!,
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
      isLinked: linkedFlags[index]!,
      isPending: false,
      timeoutSeconds: 0,
      status: "pending",
    });
  }

  return {
    postingRows,
    tbPlanRows,
    pendingTransferIdsByRef,
  };
}
