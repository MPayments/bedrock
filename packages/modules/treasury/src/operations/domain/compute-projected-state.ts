import type { TreasuryOperationKind } from "./operation-types";
import {
  DOCUMENT_KIND_TO_OPERATION_PROJECTION,
  type TreasuryOperationProjectedState,
} from "./projection-map";

export interface ProjectionPostedDocument {
  docType: string;
}

export function computeOperationProjectedState(input: {
  operationKind: TreasuryOperationKind;
  postedDocuments: readonly ProjectionPostedDocument[];
}): TreasuryOperationProjectedState {
  const relevantStates: Exclude<TreasuryOperationProjectedState, "planned">[] =
    [];

  for (const doc of input.postedDocuments) {
    const entry = DOCUMENT_KIND_TO_OPERATION_PROJECTION[doc.docType];
    if (!entry) continue;
    if (entry.applicableOpKind !== input.operationKind) continue;
    relevantStates.push(entry.stateWhenPosted);
  }

  if (relevantStates.length === 0) return "planned";
  if (relevantStates.includes("voided")) return "voided";
  if (relevantStates.includes("settled")) return "settled";
  return "in_progress";
}
