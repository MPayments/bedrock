import type { TreasuryOperationKind } from "./operation-types";

export const TREASURY_OPERATION_PROJECTED_STATE_VALUES = [
  "planned",
  "in_progress",
  "settled",
  "voided",
] as const;

export type TreasuryOperationProjectedState =
  (typeof TREASURY_OPERATION_PROJECTED_STATE_VALUES)[number];

export interface DocumentProjectionEntry {
  applicableOpKind: TreasuryOperationKind;
  stateWhenPosted: Exclude<TreasuryOperationProjectedState, "planned">;
}

// The key is the doc's `docType`. Resolution-style docs (fx_resolution,
// transfer_resolution) currently default to "settled" since the deal-trace
// read row does not expose the payload's resolutionType; a void-resolution
// therefore projects as "settled" until the read model is enriched.
export const DOCUMENT_KIND_TO_OPERATION_PROJECTION: Record<
  string,
  DocumentProjectionEntry
> = {
  invoice: { applicableOpKind: "payin", stateWhenPosted: "in_progress" },
  payin_funding: { applicableOpKind: "payin", stateWhenPosted: "settled" },
  fx_execute: {
    applicableOpKind: "fx_conversion",
    stateWhenPosted: "in_progress",
  },
  fx_resolution: {
    applicableOpKind: "fx_conversion",
    stateWhenPosted: "settled",
  },
  transfer_intra: {
    applicableOpKind: "intracompany_transfer",
    stateWhenPosted: "settled",
  },
  transfer_intercompany: {
    applicableOpKind: "intercompany_funding",
    stateWhenPosted: "settled",
  },
  transfer_resolution: {
    applicableOpKind: "payout",
    stateWhenPosted: "settled",
  },
  payout_initiate: {
    applicableOpKind: "payout",
    stateWhenPosted: "in_progress",
  },
  payout_settle: { applicableOpKind: "payout", stateWhenPosted: "settled" },
  payout_void: { applicableOpKind: "payout", stateWhenPosted: "voided" },
};
