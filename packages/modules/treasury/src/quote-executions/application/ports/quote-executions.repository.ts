import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  QuoteExecutionRecord,
  QuoteExecutionState,
} from "../../domain/types";

export interface QuoteExecutionsListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  quoteId?: string;
  state?: QuoteExecutionState;
  treasuryOrderId?: string;
}

export interface QuoteExecutionsRepository {
  findById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | undefined>;
  insert(
    input: QuoteExecutionRecord,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | null>;
  list(
    input: QuoteExecutionsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: QuoteExecutionRecord[]; total: number }>;
  update(
    input: QuoteExecutionRecord,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | undefined>;
}
