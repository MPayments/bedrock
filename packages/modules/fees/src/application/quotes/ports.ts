import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  FeeComponentKind,
  FeeSettlementMode,
  FeeSource,
} from "../../contracts";

export interface FeesQuoteComponentSnapshotWriteModel {
  quoteId: string;
  idx: number;
  ruleId: string | null;
  kind: FeeComponentKind;
  currencyId: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode: FeeSettlementMode;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FeesQuoteComponentSnapshotRecord {
  quoteId: string;
  idx: number;
  ruleId: string | null;
  kind: FeeComponentKind;
  currencyId: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode: FeeSettlementMode;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FeesQuoteSnapshotsQueryRepository {
  listQuoteFeeComponents(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<FeesQuoteComponentSnapshotRecord[]>;
}

export interface FeesQuoteSnapshotsCommandRepository {
  replaceQuoteFeeComponents(
    input: {
      quoteId: string;
      components: FeesQuoteComponentSnapshotWriteModel[];
    },
    tx?: PersistenceSession,
  ): Promise<void>;
}
