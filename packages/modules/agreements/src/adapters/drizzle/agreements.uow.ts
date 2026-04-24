import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleAgreementReads } from "./agreement.reads";
import { DrizzleAgreementStore } from "./agreement.store";
import type {
  AgreementsCommandTx,
  AgreementsCommandUnitOfWork,
} from "../../application/ports/agreements.uow";

function bindAgreementTx(
  transaction: Transaction,
  idempotency: IdempotencyPort,
): AgreementsCommandTx {
  return {
    agreementReads: new DrizzleAgreementReads(
      transaction,
      createCurrenciesQueries({ db: transaction }),
    ),
    agreementStore: new DrizzleAgreementStore(transaction),
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

export class DrizzleAgreementsUnitOfWork implements AgreementsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<AgreementsCommandTx>;

  constructor(input: {
    idempotency: IdempotencyPort;
    persistence: PersistenceContext;
  }) {
    this.transactional = createTransactionalPort(input.persistence, (tx) =>
      bindAgreementTx(tx, input.idempotency),
    );
  }

  run<T>(work: (tx: AgreementsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
