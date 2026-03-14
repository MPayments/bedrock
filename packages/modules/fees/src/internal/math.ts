import { BPS_SCALE } from "@bedrock/shared/money/math";

import { FeeValidationError } from "../errors";

export function calculateBpsAmount(amountMinor: bigint, bps: number): bigint {
    if (amountMinor < 0n) throw new FeeValidationError("amountMinor must be non-negative");
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        throw new FeeValidationError("bps must be an integer between 0 and 10000");
    }

    return (amountMinor * BigInt(bps)) / BPS_SCALE;
}
