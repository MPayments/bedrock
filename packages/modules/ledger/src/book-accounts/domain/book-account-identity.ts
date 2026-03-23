import type { Dimensions } from "../../shared/domain/dimensions";
import { computeDimensionsHash } from "../../shared/domain/dimensions-hash";

export interface BookAccountIdentityInput {
  bookId: string;
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

export interface BookAccountIdentity {
  dimensionsHash: string;
}

export interface BookAccountInstanceRef extends BookAccountIdentity {
  id: string;
  settlementLedger: number;
  settlementAccountId: bigint;
}

export function computeBookAccountIdentity(
  input: BookAccountIdentityInput,
): BookAccountIdentity {
  return {
    dimensionsHash: computeDimensionsHash(input.dimensions),
  };
}
