import { noopLogger, type Logger } from "@bedrock/kernel";

import { ConnectorProviderNotConfiguredError } from "../errors";
import type { ConnectorsService } from "../service";

function computeRetryAt(attemptNo: number, now: Date): Date {
  const delaySeconds = Math.min(1800, Math.pow(2, Math.max(1, attemptNo)));
  return new Date(now.getTime() + delaySeconds * 1000);
}

export function createAttemptDispatchWorker(deps: {
  connectors: Pick<
    ConnectorsService,
    | "claimDispatchBatch"
    | "recordAttemptStatus"
    | "upsertProviderHealth"
    | "providers"
  >;
  logger?: Logger;
}) {
  const { connectors } = deps;
  const log =
    deps.logger?.child({ svc: "connectors-attempt-dispatch" }) ?? noopLogger;

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 50;
    const claimed = await connectors.claimDispatchBatch({ batchSize });
    let processed = 0;

    for (const item of claimed) {
      const { attempt, intent } = item;
      const provider = connectors.providers[attempt.providerCode];
      const now = new Date();

      try {
        if (!provider) {
          throw new ConnectorProviderNotConfiguredError(attempt.providerCode);
        }

        const result = await provider.initiate({
          intent: {
            id: intent.id,
            documentId: intent.documentId,
            docType: intent.docType,
            direction: intent.direction,
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            corridor: intent.corridor,
            metadata: intent.metadata,
          },
          attempt: {
            id: attempt.id,
            attemptNo: attempt.attemptNo,
            providerCode: attempt.providerCode,
            idempotencyKey: attempt.idempotencyKey,
            requestPayload: attempt.requestPayload,
          },
        });

        await connectors.recordAttemptStatus({
          attemptId: attempt.id,
          status: result.status,
          externalAttemptRef: result.externalAttemptRef ?? undefined,
          responsePayload: result.responsePayload ?? undefined,
          error: result.error ?? undefined,
          nextRetryAt: result.nextRetryAt ?? undefined,
          idempotencyKey: `${attempt.id}:dispatch:${attempt.attemptNo}`,
        });

        await connectors.upsertProviderHealth({
          providerCode: attempt.providerCode,
          status: result.status === "failed_terminal" ? "degraded" : "up",
          score: result.status === "failed_terminal" ? 30 : 90,
          error: result.error ?? null,
          successDelta: result.status === "failed_terminal" ? 0 : 1,
          failureDelta: result.status === "failed_terminal" ? 1 : 0,
        });

        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("Connector dispatch failed", {
          attemptId: attempt.id,
          providerCode: attempt.providerCode,
          error: message,
        });

        await connectors.recordAttemptStatus({
          attemptId: attempt.id,
          status: "failed_retryable",
          error: message,
          nextRetryAt: computeRetryAt(attempt.attemptNo, now),
          idempotencyKey: `${attempt.id}:dispatch:error:${attempt.attemptNo}`,
        });
        await connectors.upsertProviderHealth({
          providerCode: attempt.providerCode,
          status: "degraded",
          score: 20,
          error: message,
          failureDelta: 1,
        });
      }
    }

    return processed;
  }

  return { processOnce };
}
