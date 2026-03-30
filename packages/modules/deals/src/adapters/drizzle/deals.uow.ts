import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleDealReads } from "./deal.reads";
import { DrizzleDealStore } from "./deal.store";
import type {
  DealsCommandTx,
  DealsCommandUnitOfWork,
} from "../../application/ports/deals.uow";

function bindDealsTx(transaction: Transaction): DealsCommandTx {
  return {
    transaction,
    dealReads: new DrizzleDealReads(transaction),
    dealStore: new DrizzleDealStore(transaction),
  };
}

export class DrizzleDealsUnitOfWork implements DealsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<DealsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindDealsTx,
    );
  }

  run<T>(work: (tx: DealsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
