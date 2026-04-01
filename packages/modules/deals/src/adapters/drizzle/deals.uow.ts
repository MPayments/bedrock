import { createCurrenciesQueries } from "@bedrock/currencies/queries";
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
import type {
  DealsCommandTx,
  DealsCommandUnitOfWork,
} from "../../application/ports/deals.uow";

function bindDealsTx(
  transaction: Transaction,
  bindDocumentsReadModel?: (db: Queryable) => DealDocumentsReadModel,
): DealsCommandTx {
  return {
    transaction,
    dealReads: new DrizzleDealReads(
      transaction,
      createCurrenciesQueries({ db: transaction }),
      bindDocumentsReadModel?.(transaction),
    ),
    dealStore: new DrizzleDealStore(transaction),
  };
}

export class DrizzleDealsUnitOfWork implements DealsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<DealsCommandTx>;

  constructor(input: {
    bindDocumentsReadModel?: (db: Queryable) => DealDocumentsReadModel;
    persistence: PersistenceContext;
  }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      (transaction) => bindDealsTx(transaction, input.bindDocumentsReadModel),
    );
  }

  run<T>(work: (tx: DealsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
