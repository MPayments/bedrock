import { noopLogger, type Logger } from "@bedrock/kernel";
import type { ConnectorsService } from "@bedrock/core/connectors";

import type { BedrockWorker, WorkerRunContext, WorkerRunResult } from "../worker-runtime";
import type { OrchestrationService } from "./service";

function readBookIdFromIntentMetadata(
  metadata: Record<string, unknown> | null,
): string {
  const value = metadata?.bookId;
  return typeof value === "string" && value.length > 0 ? value : "default";
}

function readOptionalBookIdFromIntentMetadata(
  metadata: Record<string, unknown> | null,
): string | undefined {
  const value = metadata?.bookId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface OrchestrationRetryAttemptContext {
  attemptId: string;
  intentId: string;
  bookId?: string;
}

type OrchestrationRetryAttemptGuard = (
  input: OrchestrationRetryAttemptContext,
) => Promise<boolean> | boolean;

export function createOrchestrationRetryWorkerDefinition(deps: {
  id?: string;
  componentId?: string;
  intervalMs?: number;
  connectors: Pick<
    ConnectorsService,
    "listAttempts" | "getIntentById" | "enqueueAttempt"
  >;
  orchestration: Pick<
    OrchestrationService,
    "selectNextProviderForIntent" | "recordAttemptOutcome"
  >;
  logger?: Logger;
  beforeAttempt?: OrchestrationRetryAttemptGuard;
  batchSize?: number;
}): BedrockWorker {
  const { connectors, orchestration } = deps;
  const beforeAttempt = deps.beforeAttempt;
  const log =
    deps.logger?.child({ svc: "orchestration-retry-worker" }) ?? noopLogger;
  const batchSize = deps.batchSize ?? 25;

  async function runPass(now: Date) {
    const attempts = await connectors.listAttempts({
      status: "failed_retryable",
      limit: batchSize,
      offset: 0,
    });
    let processed = 0;

    for (const attempt of attempts) {
      if (attempt.nextRetryAt && attempt.nextRetryAt.getTime() > now.getTime()) {
        continue;
      }

      const intent = await connectors.getIntentById(attempt.intentId);
      if (!intent) {
        continue;
      }
      if (intent.currentAttemptNo > attempt.attemptNo) {
        // A newer attempt is already scheduled for this intent.
        continue;
      }
      const bookId = readOptionalBookIdFromIntentMetadata(intent.metadata);

      if (beforeAttempt) {
        const isEnabled = await beforeAttempt({
          attemptId: attempt.id,
          intentId: intent.id,
          bookId,
        });
        if (!isEnabled) {
          continue;
        }
      }

      try {
        const next = await orchestration.selectNextProviderForIntent({
          intentId: intent.id,
          bookId: readBookIdFromIntentMetadata(intent.metadata),
        });
        await connectors.enqueueAttempt({
          intentId: intent.id,
          providerCode: next.selected.providerCode,
          providerRoute:
            next.selected.degradationOrder[0] ?? intent.corridor ?? "default",
          requestPayload: {
            retryFromAttemptId: attempt.id,
            amountMinor: intent.amountMinor.toString(),
            currency: intent.currency,
          },
          idempotencyKey: `${attempt.id}:retry:${attempt.attemptNo + 1}`,
        });
        await orchestration.recordAttemptOutcome({
          providerCode: attempt.providerCode,
          status: "failed_retryable",
        });
        processed += 1;
      } catch (error) {
        log.error("Orchestration retry scheduling failed", {
          attemptId: attempt.id,
          intentId: intent.id,
          error: error instanceof Error ? error.message : String(error),
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
    id: deps.id ?? "orchestration-retry",
    componentId: deps.componentId ?? "orchestration",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}
