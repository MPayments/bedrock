import { noopLogger, type Logger } from "@bedrock/kernel";

import { ConnectorProviderNotConfiguredError } from "../errors";
import type { ConnectorsService } from "../service";

export function createStatementIngestWorker(deps: {
  connectors: Pick<
    ConnectorsService,
    "claimStatementProviders" | "ingestStatementBatch" | "providers"
  >;
  logger?: Logger;
}) {
  const { connectors } = deps;
  const log =
    deps.logger?.child({ svc: "connectors-statement-ingest" }) ?? noopLogger;

  async function processOnce(opts?: { batchSize?: number; now?: Date }) {
    const now = opts?.now ?? new Date();
    const batchSize = opts?.batchSize ?? 20;
    const cursors = await connectors.claimStatementProviders({ batchSize });
    let processed = 0;

    for (const cursor of cursors) {
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

        const ingestResult = await connectors.ingestStatementBatch({
          providerCode: cursor.providerCode,
          cursorKey: cursor.cursorKey,
          cursorValue: result.nextCursor ?? cursor.cursorValue ?? undefined,
          records: result.records,
          idempotencyKey: `${cursor.providerCode}:statement:${cursor.cursorKey}:${now.toISOString()}`,
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
    const provider = connectors.providers[input.providerCode];
    if (!provider) {
      throw new ConnectorProviderNotConfiguredError(input.providerCode);
    }

    const result = await provider.fetchStatements({
      range: input.range,
      cursor: input.cursorValue,
    });
    return connectors.ingestStatementBatch({
      providerCode: input.providerCode,
      cursorKey: input.cursorKey ?? "default",
      cursorValue: result.nextCursor ?? input.cursorValue ?? undefined,
      records: result.records,
      idempotencyKey: `${input.providerCode}:statement:manual:${input.range.from.toISOString()}:${input.range.to.toISOString()}`,
    });
  }

  return { processOnce, processProviderOnce };
}
