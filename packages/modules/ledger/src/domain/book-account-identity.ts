import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "../ids";
import type { Dimensions } from "./dimensions";

export interface BookAccountIdentityInput {
  bookId: string;
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

export interface BookAccountIdentity {
  dimensionsHash: string;
  tbLedger: number;
  tbAccountId: bigint;
}

export interface BookAccountInstanceRef extends BookAccountIdentity {
  id: string;
}

export function computeBookAccountIdentity(
  input: BookAccountIdentityInput,
): BookAccountIdentity {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const tbAccountId = tbBookAccountInstanceIdFor(
    input.bookId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

  return {
    dimensionsHash,
    tbLedger,
    tbAccountId,
  };
}
