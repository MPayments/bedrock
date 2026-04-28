import {
  ListPendingReconciliationExternalRecordIdsInputSchema,
  type ListPendingReconciliationExternalRecordIdsInput,
} from "../../contracts";
import type { ReconciliationServiceContext } from "../shared/context";

export function createListPendingExternalRecordIdsHandler(
  context: ReconciliationServiceContext,
) {
  const { pendingSources } = context;

  return async function listPendingExternalRecordIds(
    input: ListPendingReconciliationExternalRecordIdsInput,
  ): Promise<string[]> {
    const validated =
      ListPendingReconciliationExternalRecordIdsInputSchema.parse(input);

    return pendingSources.listPendingExternalRecordIds(validated);
  };
}
