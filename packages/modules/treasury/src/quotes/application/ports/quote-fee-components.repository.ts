import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  FeeComponentKind,
  FeeSettlementMode,
  FeeSource,
} from "../../../fees/application/contracts";

export interface QuoteFeeComponentSnapshotWriteModel {
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

export interface QuoteFeeComponentSnapshotRecord {
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

export interface ReplaceQuoteFeeComponentsInput {
  quoteId: string;
  components: QuoteFeeComponentSnapshotWriteModel[];
}

export interface QuoteFeeComponentsRepository {
  listQuoteFeeComponents(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<QuoteFeeComponentSnapshotRecord[]>;
  replaceQuoteFeeComponents(
    input: ReplaceQuoteFeeComponentsInput,
    tx?: PersistenceSession,
  ): Promise<void>;
}
