import { stableStringify } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";

import { computeDimensionsHash, tbTransferIdForOperation } from "../ids";
import {
  OPERATION_TRANSFER_TYPE,
  type IntentLine,
} from "./operation-intent";

function normalizeForFingerprint(line: IntentLine) {
  switch (line.type) {
    case OPERATION_TRANSFER_TYPE.CREATE:
      return {
        type: line.type,
        planRef: line.planRef,
        bookId: line.bookId,
        chain: line.chain ?? null,
        postingCode: line.postingCode,
        debit: {
          accountNo: line.debit.accountNo,
          currency: line.debit.currency,
          dimensionsHash: computeDimensionsHash(line.debit.dimensions),
        },
        credit: {
          accountNo: line.credit.accountNo,
          currency: line.credit.currency,
          dimensionsHash: computeDimensionsHash(line.credit.dimensions),
        },
        amount: line.amountMinor.toString(),
        code: line.code ?? 1,
        pendingTimeoutSeconds: line.pending?.timeoutSeconds ?? 0,
        pendingRef: line.pending?.ref ?? null,
      };
    case OPERATION_TRANSFER_TYPE.POST_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: (line.amount ?? 0n).toString(),
        code: line.code ?? 0,
      };
    case OPERATION_TRANSFER_TYPE.VOID_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: "0",
        code: line.code ?? 0,
      };
  }
}

export function computeLinkedFlags(lines: IntentLine[]): boolean[] {
  const linked = new Array(lines.length).fill(false);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index]!.chain;
    const next = lines[index + 1]!.chain;

    if (current && next && current === next) {
      linked[index] = true;
    }
  }

  return linked;
}

export function computePayloadHash(input: {
  operationCode: string;
  operationVersion: number;
  payload: unknown;
  lines: IntentLine[];
}): string {
  return sha256Hex(
    stableStringify({
      operationCode: input.operationCode,
      operationVersion: input.operationVersion,
      payload: input.payload ?? null,
      lines: input.lines.map(normalizeForFingerprint),
    }),
  );
}

export function buildReplayTransferMaps(
  operationId: string,
  lines: IntentLine[],
) {
  const pendingTransferIdsByRef = new Map<string, bigint>();

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE && line.pending) {
      pendingTransferIdsByRef.set(line.pending.ref ?? line.planRef, transferId);
    }
  }

  return { pendingTransferIdsByRef };
}
