import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson } from "@bedrock/shared/core/canon";

import { createRunReconciliationHandler } from "../runs/commands";
import type { ReconciliationServiceContext } from "../shared/context";

export interface ReconciliationWorkerSourceContext {
  source: string;
  externalRecordIds: string[];
}

export type ReconciliationWorkerSourceGuard = (
  input: ReconciliationWorkerSourceContext,
) => Promise<boolean> | boolean;

function buildRunIdempotencyKey(input: {
  source: string;
  rulesetChecksum: string;
  externalRecordIds: string[];
}) {
  return sha256Hex(
    canonicalJson({
      worker: "reconciliation",
      source: input.source,
      rulesetChecksum: input.rulesetChecksum,
      externalRecordIds: input.externalRecordIds,
    }),
  );
}

export function createProcessPendingSourcesHandler(
  context: ReconciliationServiceContext,
) {
  const { pendingSources } = context;
  const runReconciliation = createRunReconciliationHandler(context);

  return async function processPendingSources(input: {
    rulesetChecksum: string;
    batchSize: number;
    beforeSource?: ReconciliationWorkerSourceGuard;
  }): Promise<number> {
    const pending = await pendingSources.listPendingSources(input.batchSize);
    let processed = 0;

    for (const source of pending) {
      if (input.beforeSource) {
        const isEnabled = await input.beforeSource({
          source: source.source,
          externalRecordIds: source.externalRecordIds,
        });

        if (!isEnabled) {
          continue;
        }
      }

      await runReconciliation({
        source: source.source,
        rulesetChecksum: input.rulesetChecksum,
        inputQuery: {
          externalRecordIds: source.externalRecordIds,
        },
        idempotencyKey: buildRunIdempotencyKey({
          source: source.source,
          rulesetChecksum: input.rulesetChecksum,
          externalRecordIds: source.externalRecordIds,
        }),
      });
      processed += 1;
    }

    return processed;
  };
}
