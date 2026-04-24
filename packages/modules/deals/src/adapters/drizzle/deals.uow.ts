import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  createTransactionalPort,
  type Queryable,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import {
  DrizzleDealReads,
  type DealDocumentsReadModel,
} from "./deal.reads";
import { DrizzleDealStore } from "./deal.store";
import type { DealFundingAssessmentPort } from "../../application/ports/deal.reads";
import type {
  DealsCommandTx,
  DealsCommandUnitOfWork,
} from "../../application/ports/deals.uow";

function bindDealsTx(
  transaction: Transaction,
  idempotency: IdempotencyPort,
  bindDocumentsReadModel?: (db: Queryable) => DealDocumentsReadModel,
  fundingAssessment?: DealFundingAssessmentPort,
): DealsCommandTx {
  return {
    dealReads: new DrizzleDealReads(
      transaction,
      createCurrenciesQueries({ db: transaction }),
      createPartiesQueries({ db: transaction }),
      bindDocumentsReadModel?.(transaction),
      fundingAssessment,
    ),
    dealStore: new DrizzleDealStore(transaction),
    idempotency: {
      withIdempotency: (input) =>
        idempotency.withIdempotencyTx({
          actorId: input.actorId,
          handler: input.handler,
          idempotencyKey: input.idempotencyKey,
          loadReplayResult: ({ receipt, storedResult }) =>
            input.loadReplayResult({ receipt, storedResult }),
          request: input.request,
          scope: input.scope,
          serializeResult: input.serializeResult,
          tx: transaction,
        }),
    },
  };
}

export class DrizzleDealsUnitOfWork implements DealsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<DealsCommandTx>;

  constructor(input: {
    bindDocumentsReadModel?: (db: Queryable) => DealDocumentsReadModel;
    fundingAssessment?: DealFundingAssessmentPort;
    idempotency: IdempotencyPort;
    persistence: PersistenceContext;
  }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      (transaction) =>
        bindDealsTx(
          transaction,
          input.idempotency,
          input.bindDocumentsReadModel,
          input.fundingAssessment,
        ),
    );
  }

  run<T>(work: (tx: DealsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
