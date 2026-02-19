import { TransferCodes } from "@bedrock/kernel/constants";

import type { FeeComponentDefaults } from "../types";

export function getComponentDefaults(kind: string): FeeComponentDefaults {
    switch (kind) {
        case "fx_fee":
            return {
                bucket: "fx_fee",
                transferCode: TransferCodes.FEE_REVENUE,
                memo: "Fee revenue",
            };
        case "fx_spread":
            return {
                bucket: "fx_spread",
                transferCode: TransferCodes.SPREAD_REVENUE,
                memo: "FX spread revenue",
            };
        case "bank_fee":
            return {
                bucket: "bank",
                transferCode: TransferCodes.BANK_FEE_REVENUE,
                memo: "Bank fee revenue",
            };
        case "blockchain_fee":
            return {
                bucket: "blockchain",
                transferCode: TransferCodes.BLOCKCHAIN_FEE_REVENUE,
                memo: "Blockchain fee revenue",
            };
        case "manual_fee":
            return {
                bucket: "manual",
                transferCode: TransferCodes.ARBITRARY_FEE_REVENUE,
                memo: "Manual fee",
            };
        default:
            return {
                bucket: "custom",
                transferCode: TransferCodes.ARBITRARY_FEE_REVENUE,
                memo: "Fee revenue",
            };
    }
}
