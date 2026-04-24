import type { UnitOfWork } from "@bedrock/shared/core/unit-of-work";

import type { DealReads } from "./deal.reads";
import type { DealStore } from "./deal.store";

export interface DealsCommandIdempotencyInput<TResult> {
  actorId?: string | null;
  handler(): Promise<TResult>;
  idempotencyKey: string;
  loadReplayResult(input: {
    receipt: {
      errorJson: unknown;
      id: string;
      idempotencyKey: string;
      requestHash: string;
      resultJson: unknown;
      scope: string;
      status: string;
    };
    storedResult: Record<string, unknown> | null;
  }): Promise<TResult>;
  request: unknown;
  scope: string;
  serializeResult(result: TResult): Record<string, unknown>;
}

export interface DealsCommandIdempotencyPort {
  withIdempotency<TResult>(
    input: DealsCommandIdempotencyInput<TResult>,
  ): Promise<TResult>;
}

export interface DealsCommandTx {
  dealReads: DealReads;
  dealStore: DealStore;
  idempotency: DealsCommandIdempotencyPort;
}

export type DealsCommandUnitOfWork = UnitOfWork<DealsCommandTx>;
