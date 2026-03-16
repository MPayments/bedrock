import { eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  FeesQuoteComponentSnapshotRecord,
  FeesQuoteComponentSnapshotWriteModel,
  FeesQuoteSnapshotsCommandRepository,
  FeesQuoteSnapshotsQueryRepository,
} from "../../../application/quotes/ports";
import { schema } from "../schema";

export function createDrizzleFeesQuoteSnapshotsRepository(input: {
  db: Database;
}): FeesQuoteSnapshotsQueryRepository & FeesQuoteSnapshotsCommandRepository {
  const { db } = input;

  async function replaceQuoteFeeComponents(
    input: {
      quoteId: string;
      components: FeesQuoteComponentSnapshotWriteModel[];
    },
    tx?: PersistenceSession,
  ): Promise<void> {
    const queryExecutor = (tx as Transaction | undefined) ?? db;

    await queryExecutor
      .delete(schema.fxQuoteFeeComponents)
      .where(eq(schema.fxQuoteFeeComponents.quoteId, input.quoteId));

    if (!input.components.length) {
      return;
    }

    await queryExecutor.insert(schema.fxQuoteFeeComponents).values(
      input.components.map((component) => ({
        quoteId: component.quoteId,
        idx: component.idx,
        ruleId: component.ruleId,
        kind: component.kind,
        currencyId: component.currencyId,
        amountMinor: component.amountMinor,
        source: component.source,
        settlementMode: component.settlementMode,
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: component.memo,
        metadata: component.metadata,
      })),
    );
  }

  async function listQuoteFeeComponents(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<FeesQuoteComponentSnapshotRecord[]> {
    const queryExecutor = (tx as Transaction | undefined) ?? db;

    return queryExecutor
      .select({
        quoteId: schema.fxQuoteFeeComponents.quoteId,
        idx: schema.fxQuoteFeeComponents.idx,
        ruleId: schema.fxQuoteFeeComponents.ruleId,
        kind: schema.fxQuoteFeeComponents.kind,
        currencyId: schema.fxQuoteFeeComponents.currencyId,
        amountMinor: schema.fxQuoteFeeComponents.amountMinor,
        source: schema.fxQuoteFeeComponents.source,
        settlementMode: schema.fxQuoteFeeComponents.settlementMode,
        memo: schema.fxQuoteFeeComponents.memo,
        metadata: schema.fxQuoteFeeComponents.metadata,
      })
      .from(schema.fxQuoteFeeComponents)
      .where(eq(schema.fxQuoteFeeComponents.quoteId, quoteId))
      .limit(2048);
  }

  return {
    replaceQuoteFeeComponents,
    listQuoteFeeComponents,
  };
}
