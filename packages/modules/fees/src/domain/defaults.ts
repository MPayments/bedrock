import { TransferCodes } from "@bedrock/accounting/constants";

import type { FeeComponentDefaults } from "../contracts";

export function getComponentDefaults(kind: string): FeeComponentDefaults {
  switch (kind) {
    case "fx_fee":
      return {
        bucket: "fx_fee",
        transferCode: TransferCodes.FEE_INCOME,
        memo: "Fee revenue",
      };
    case "fx_spread":
      return {
        bucket: "fx_spread",
        transferCode: TransferCodes.SPREAD_INCOME,
        memo: "FX spread revenue",
      };
    case "bank_fee":
      return {
        bucket: "bank",
        transferCode: TransferCodes.FEE_INCOME,
        memo: "Bank fee revenue",
      };
    case "blockchain_fee":
      return {
        bucket: "blockchain",
        transferCode: TransferCodes.FEE_INCOME,
        memo: "Blockchain fee revenue",
      };
    case "manual_fee":
      return {
        bucket: "manual",
        transferCode: TransferCodes.FEE_INCOME,
        memo: "Manual fee",
      };
    default:
      return {
        bucket: "custom",
        transferCode: TransferCodes.FEE_INCOME,
        memo: "Fee revenue",
      };
  }
}
