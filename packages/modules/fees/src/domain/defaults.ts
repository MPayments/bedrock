import type { FeeComponentDefaults } from "./fee-types";

const DEFAULT_TRANSFER_CODES = {
  FEE_INCOME: 3001,
  SPREAD_INCOME: 3002,
} as const;

export function getComponentDefaults(kind: string): FeeComponentDefaults {
  switch (kind) {
    case "fx_fee":
      return {
        bucket: "fx_fee",
        transferCode: DEFAULT_TRANSFER_CODES.FEE_INCOME,
        memo: "Fee revenue",
      };
    case "fx_spread":
      return {
        bucket: "fx_spread",
        transferCode: DEFAULT_TRANSFER_CODES.SPREAD_INCOME,
        memo: "FX spread revenue",
      };
    case "bank_fee":
      return {
        bucket: "bank",
        transferCode: DEFAULT_TRANSFER_CODES.FEE_INCOME,
        memo: "Bank fee revenue",
      };
    case "blockchain_fee":
      return {
        bucket: "blockchain",
        transferCode: DEFAULT_TRANSFER_CODES.FEE_INCOME,
        memo: "Blockchain fee revenue",
      };
    case "manual_fee":
      return {
        bucket: "manual",
        transferCode: DEFAULT_TRANSFER_CODES.FEE_INCOME,
        memo: "Manual fee",
      };
    default:
      return {
        bucket: "custom",
        transferCode: DEFAULT_TRANSFER_CODES.FEE_INCOME,
        memo: "Fee revenue",
      };
  }
}
