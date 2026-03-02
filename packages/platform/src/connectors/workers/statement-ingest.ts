import { noopLogger, sha256Hex, stableStringify, type Logger } from "@bedrock/foundation/kernel";

import { ConnectorProviderNotConfiguredError } from "../errors";
import type { ConnectorsService } from "../service";

export interface StatementIngestWorkerCursorContext {
  providerCode: string;
  cursorKey: string;
}

type StatementIngestWorkerCursorGuard = (
  input: StatementIngestWorkerCursorContext,
) => Promise<boolean> | boolean;

export function createStatementIngestWorker(deps: {
  connectors: Pick<
    ConnectorsService,
    "claimStatementProviders" | "ingestStatementBatch" | "providers"
  >;
  logger?: Logger;
  beforeCursor?: StatementIngestWorkerCursorGuard;
}) {
  const { connectors } = deps;
  const beforeCursor = deps.beforeCursor;
  const log =
    deps.logger?.child({ svc: "connectors-statement-ingest" }) ?? noopLogger;

  async function processOnce(opts?: {
    batchSize?: number;
    workerId?: string;
    leaseSec?: number;
    now?: Date;
  }) {
    const now = opts?.now ?? new Date();
    const batchSize = opts?.batchSize ?? 20;
    const workerId = opts?.workerId ?? "statement-ingest";
    const leaseSec = opts?.leaseSec ?? 120;
    const cursors = await connectors.claimStatementProviders({
      batchSize,
      workerId,
      leaseSec,
      now,
    });
    let processed = 0;

    for (const cursor of cursors) {
      if (beforeCursor) {
        const isEnabled = await beforeCursor({
          providerCode: cursor.providerCode,
          cursorKey: cursor.cursorKey,
        });
        if (!isEnabled) {
          continue;
        }
      }

      const provider = connectors.providers[cursor.providerCode];
      if (!provider) {
        log.warn("Connector statement provider is not configured", {
          providerCode: cursor.providerCode,
        });
        continue;
      }

      try {
        const result = await provider.fetchStatements({
          range: {
            from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            to: now,
          },
          cursor: cursor.cursorValue,
        });
        const ingestFingerprint = sha256Hex(
          stableStringify({
            providerCode: cursor.providerCode,
            cursorKey: cursor.cursorKey,
            cursorValue: cursor.cursorValue ?? null,
            nextCursor: result.nextCursor ?? null,
            records: result.records.map((record) => ({
              recordId: record.recordId,
              occurredAt: record.occurredAt.toISOString(),
            })),
          }),
        );

        const ingestResult = await connectors.ingestStatementBatch({
          providerCode: cursor.providerCode,
          cursorKey: cursor.cursorKey,
          cursorValue: result.nextCursor ?? cursor.cursorValue ?? undefined,
          records: result.records,
          idempotencyKey: `${cursor.providerCode}:statement:${cursor.cursorKey}:${ingestFingerprint}`,
        });

        processed += ingestResult.inserted;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("Connector statement ingestion failed", {
          providerCode: cursor.providerCode,
          cursorKey: cursor.cursorKey,
          error: message,
        });
      }
    }

    return processed;
  }

  async function processProviderOnce(input: {
    providerCode: string;
    cursorKey?: string;
    cursorValue?: string | null;
    range: { from: Date; to: Date };
  }) {
    if (beforeCursor) {
      const isEnabled = await beforeCursor({
        providerCode: input.providerCode,
        cursorKey: input.cursorKey ?? "default",
      });
      if (!isEnabled) {
        return { inserted: 0 };
      }
    }

    const provider = connectors.providers[input.providerCode];
    if (!provider) {
      throw new ConnectorProviderNotConfiguredError(input.providerCode);
    }

    const result = await provider.fetchStatements({
      range: input.range,
      cursor: input.cursorValue,
    });
    const manualFingerprint = sha256Hex(
      stableStringify({
        providerCode: input.providerCode,
        cursorKey: input.cursorKey ?? "default",
        cursorValue: input.cursorValue ?? null,
        range: {
          from: input.range.from.toISOString(),
          to: input.range.to.toISOString(),
        },
        nextCursor: result.nextCursor ?? null,
        records: result.records.map((record) => ({
          recordId: record.recordId,
          occurredAt: record.occurredAt.toISOString(),
        })),
      }),
    );
    return connectors.ingestStatementBatch({
      providerCode: input.providerCode,
      cursorKey: input.cursorKey ?? "default",
      cursorValue: result.nextCursor ?? input.cursorValue ?? undefined,
      records: result.records,
      idempotencyKey: `${input.providerCode}:statement:manual:${manualFingerprint}`,
    });
  }

  return { processOnce, processProviderOnce };
}
