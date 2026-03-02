import { noopLogger, type Logger } from "@bedrock/foundation/kernel";

import type { ConnectorsService } from "@bedrock/connectors";

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

export function createOrchestrationRetryWorker(deps: {
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
}) {
  const { connectors, orchestration } = deps;
  const beforeAttempt = deps.beforeAttempt;
  const log =
    deps.logger?.child({ svc: "orchestration-retry-worker" }) ?? noopLogger;

  async function processOnce(opts?: { batchSize?: number; now?: Date }) {
    const now = opts?.now ?? new Date();
    const batchSize = opts?.batchSize ?? 25;
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

  return {
    processOnce,
  };
}
