import type { MatchResolution } from "./matching";

export const RECONCILIATION_EXCEPTION_STATES = [
  "open",
  "resolved",
  "ignored",
] as const;

export type ReconciliationExceptionState =
  (typeof RECONCILIATION_EXCEPTION_STATES)[number];

export interface ReconciliationRunSummary {
  total: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
}

export function summarizeResolutions(
  resolutions: MatchResolution[],
): ReconciliationRunSummary {
  return {
    total: resolutions.length,
    matched: resolutions.filter((resolution) => resolution.status === "matched")
      .length,
    unmatched: resolutions.filter(
      (resolution) => resolution.status === "unmatched",
    ).length,
    ambiguous: resolutions.filter(
      (resolution) => resolution.status === "ambiguous",
    ).length,
  };
}
