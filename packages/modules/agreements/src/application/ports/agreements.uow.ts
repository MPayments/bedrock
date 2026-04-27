import type { UnitOfWork } from "@bedrock/shared/core/unit-of-work";

import type { AgreementReads } from "./agreement.reads";
import type { AgreementStore } from "./agreement.store";

export interface AgreementsCommandIdempotencyInput<TResult> {
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

export interface AgreementsCommandIdempotencyPort {
  withIdempotency<TResult>(
    input: AgreementsCommandIdempotencyInput<TResult>,
  ): Promise<TResult>;
}

export interface AgreementsCommandTx {
  agreementReads: AgreementReads;
  agreementStore: AgreementStore;
  idempotency: AgreementsCommandIdempotencyPort;
}

export type AgreementsCommandUnitOfWork = UnitOfWork<AgreementsCommandTx>;
