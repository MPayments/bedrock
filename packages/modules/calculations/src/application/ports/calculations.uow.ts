import type { UnitOfWork } from "@bedrock/shared/core/unit-of-work";

import type { CalculationReads } from "./calculation.reads";
import type { CalculationStore } from "./calculation.store";

export interface CalculationsCommandIdempotencyInput<TResult> {
  actorId?: string | null;
  handler(): Promise<TResult>;
  idempotencyKey: string;
  loadReplayResult(input: {
    storedResult: Record<string, unknown> | null;
  }): Promise<TResult>;
  request: unknown;
  scope: string;
  serializeResult(result: TResult): Record<string, unknown>;
}

export interface CalculationsCommandIdempotencyPort {
  withIdempotency<TResult>(
    input: CalculationsCommandIdempotencyInput<TResult>,
  ): Promise<TResult>;
}

export interface CalculationsCommandTx {
  calculationReads: CalculationReads;
  calculationStore: CalculationStore;
  idempotency: CalculationsCommandIdempotencyPort;
}

export type CalculationsCommandUnitOfWork =
  UnitOfWork<CalculationsCommandTx>;
