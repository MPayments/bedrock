import { invariant } from "@bedrock/shared/core/domain";

import type { TreasuryPositionRecord } from "../../shared/application/core-ports";

export function applyPositionSettlement(input: {
  position: TreasuryPositionRecord;
  amountMinor: bigint;
  now: Date;
}) {
  const nextSettledMinor = input.position.settledMinor + input.amountMinor;
  invariant(
    nextSettledMinor <= input.position.amountMinor,
    "position settlement exceeds open amount",
    {
      code: "treasury.position.over_settled",
    },
  );

  return {
    ...input.position,
    settledMinor: nextSettledMinor,
    updatedAt: input.now,
    closedAt:
      nextSettledMinor === input.position.amountMinor ? input.now : null,
  };
}
