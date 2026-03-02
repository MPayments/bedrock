import { noopLogger, sha256Hex, stableStringify, type Logger } from "@bedrock/kernel";

import type { BedrockWorker, WorkerRunContext, WorkerRunResult } from "../../worker-runtime";
import { ConnectorProviderNotConfiguredError } from "../errors";
import type { ConnectorsService } from "../service";

function computeRetryAt(attemptNo: number, now: Date): Date {
  const delaySeconds = Math.min(3600, Math.pow(2, Math.max(1, attemptNo)));
  return new Date(now.getTime() + delaySeconds * 1000);
}

function readOptionalBookIdFromIntentMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const value = metadata?.bookId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface StatusPollerWorkerItemContext {
  attemptId: string;
  intentId: string;
  bookId?: string;
}

type StatusPollerWorkerItemGuard = (
  input: StatusPollerWorkerItemContext,
) => Promise<boolean> | boolean;

export function createStatusPollerWorkerDefinition(deps: {
  id?: string;
  componentId?: string;
  intervalMs?: number;
  connectors: Pick<
    ConnectorsService,
    | "claimPollBatch"
    | "recordAttemptStatus"
    | "upsertProviderHealth"
    | "providers"
  >;
  logger?: Logger;
  beforeAttempt?: StatusPollerWorkerItemGuard;
  batchSize?: number;
  workerId?: string;
  leaseSec?: number;
}): BedrockWorker {
  const { connectors } = deps;
  const beforeAttempt = deps.beforeAttempt;
  const log =
    deps.logger?.child({ svc: "connectors-status-poller" }) ?? noopLogger;
  const batchSize = deps.batchSize ?? 50;
  const workerId = deps.workerId ?? "status-poller";
  const leaseSec = deps.leaseSec ?? 60;

  async function runPass(now: Date) {
    const claimed = await connectors.claimPollBatch({
      batchSize,
      workerId,
      leaseSec,
      now,
    });
    let processed = 0;

    for (const item of claimed) {
      const { attempt } = item;
      if (!attempt.externalAttemptRef) {
        continue;
      }
      const bookId = readOptionalBookIdFromIntentMetadata(item.intent.metadata);

      if (beforeAttempt) {
        const isEnabled = await beforeAttempt({
          attemptId: attempt.id,
          intentId: item.intent.id,
          bookId,
        });
        if (!isEnabled) {
          continue;
        }
      }

      const provider = connectors.providers[attempt.providerCode];
      try {
        if (!provider) {
          throw new ConnectorProviderNotConfiguredError(attempt.providerCode);
        }

        const status = await provider.getStatus({
          attemptId: attempt.id,
          externalAttemptRef: attempt.externalAttemptRef,
        });
        const statusFingerprint = sha256Hex(
          stableStringify({
            status: status.status,
            error: status.error ?? null,
            responsePayload: status.responsePayload ?? null,
            externalAttemptRef: attempt.externalAttemptRef,
          }),
        );

        await connectors.recordAttemptStatus({
          attemptId: attempt.id,
          status: status.status,
          responsePayload: status.responsePayload ?? undefined,
          error: status.error ?? undefined,
          nextRetryAt: status.nextRetryAt ?? undefined,
          idempotencyKey: `${attempt.providerCode}:${attempt.id}:poll:${statusFingerprint}`,
        });

        await connectors.upsertProviderHealth({
          providerCode: attempt.providerCode,
          status: status.status === "failed_terminal" ? "degraded" : "up",
          score: status.status === "failed_terminal" ? 30 : 90,
          error: status.error ?? null,
          successDelta: status.status === "failed_terminal" ? 0 : 1,
          failureDelta: status.status === "failed_terminal" ? 1 : 0,
        });
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("Connector polling failed", {
          attemptId: attempt.id,
          providerCode: attempt.providerCode,
          error: message,
        });

        await connectors.recordAttemptStatus({
          attemptId: attempt.id,
          status: "failed_retryable",
          error: message,
          nextRetryAt: computeRetryAt(attempt.attemptNo, now),
          idempotencyKey: `${attempt.providerCode}:${attempt.id}:poll:error:${sha256Hex(message)}`,
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

  async function runOnce(ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass(ctx.now);
    return { processed };
  }

  return {
    id: deps.id ?? "connectors-poller",
    componentId: deps.componentId ?? "connectors",
    intervalMs: deps.intervalMs ?? 10_000,
    runOnce,
  };
}
