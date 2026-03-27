import { invariant } from "@bedrock/shared/core/domain";

import type { ObligationRecord } from "../../shared/application/core-ports";

export function assertObligationValid(input: {
  debtorEntityId: string;
  creditorEntityId: string;
  assetId: string;
  amountMinor: bigint;
}) {
  invariant(input.debtorEntityId.trim().length > 0, "debtorEntityId is required", {
    code: "treasury.obligation.debtor_required",
  });
  invariant(
    input.creditorEntityId.trim().length > 0,
    "creditorEntityId is required",
    {
      code: "treasury.obligation.creditor_required",
    },
  );
  invariant(input.assetId.trim().length > 0, "assetId is required", {
    code: "treasury.obligation.asset_required",
  });
  invariant(input.amountMinor > 0n, "amountMinor must be positive", {
    code: "treasury.obligation.amount_positive",
  });
}

export function computeOutstandingMinor(obligation: Pick<
  ObligationRecord,
  "amountMinor" | "settledMinor"
>) {
  return obligation.amountMinor - obligation.settledMinor;
}

export function applyObligationAllocation(input: {
  obligation: ObligationRecord;
  allocatedMinor: bigint;
  now: Date;
}) {
  const nextSettledMinor = input.obligation.settledMinor + input.allocatedMinor;
  invariant(
    nextSettledMinor <= input.obligation.amountMinor,
    "allocation exceeds obligation amount",
    {
      code: "treasury.obligation.over_allocated",
    },
  );

  return {
    ...input.obligation,
    settledMinor: nextSettledMinor,
    updatedAt: input.now,
  };
}
