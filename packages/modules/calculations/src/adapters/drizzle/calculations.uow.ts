import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleCalculationReads } from "./calculation.reads";
import { DrizzleCalculationStore } from "./calculation.store";
import type {
  CalculationsCommandTx,
  CalculationsCommandUnitOfWork,
} from "../../application/ports/calculations.uow";

function bindCalculationsTx(
  transaction: Transaction,
  idempotency: IdempotencyPort,
): CalculationsCommandTx {
  return {
    calculationReads: new DrizzleCalculationReads(transaction),
    calculationStore: new DrizzleCalculationStore(transaction),
    idempotency: {
      withIdempotency: (input) =>
        idempotency.withIdempotencyTx({
          actorId: input.actorId,
          handler: input.handler,
          idempotencyKey: input.idempotencyKey,
          loadReplayResult: ({ storedResult }) =>
            input.loadReplayResult({ storedResult }),
          request: input.request,
          scope: input.scope,
          serializeResult: input.serializeResult,
          tx: transaction,
        }),
    },
  };
}

export class DrizzleCalculationsUnitOfWork
  implements CalculationsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<CalculationsCommandTx>;

  constructor(input: {
    idempotency: IdempotencyPort;
    persistence: PersistenceContext;
  }) {
    this.transactional = createTransactionalPort(input.persistence, (tx) =>
      bindCalculationsTx(tx, input.idempotency),
    );
  }

  run<T>(work: (tx: CalculationsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
