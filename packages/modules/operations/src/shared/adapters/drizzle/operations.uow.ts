import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleApplicationReads } from "../../../applications/adapters/drizzle/application.reads";
import { DrizzleCustomerBridge } from "../../../clients/adapters/drizzle/customer-bridge";
import { DrizzleClientStore } from "../../../clients/adapters/drizzle/client.store";
import type {
  ClientsCommandTx,
  ClientsCommandUnitOfWork,
} from "../../../clients/application/ports/clients.uow";
import { DrizzleDealStore } from "../../../deals/adapters/drizzle/deal.store";
import type {
  DealsCommandTx,
  DealsCommandUnitOfWork,
} from "../../../deals/application/ports/deals.uow";
import { DrizzleTodoStore } from "../../../todos/adapters/drizzle/todo.store";

type OperationsTx = DealsCommandTx & ClientsCommandTx;

function bindOperationsTx(tx: Transaction): OperationsTx {
  const applicationReads = new DrizzleApplicationReads(tx);

  return {
    dealStore: new DrizzleDealStore(tx),
    clientStore: new DrizzleClientStore(tx),
    customerBridge: new DrizzleCustomerBridge(tx),
    applicationReads,
  };
}

export class DrizzleOperationsUnitOfWork
  implements
    DealsCommandUnitOfWork,
    ClientsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<OperationsTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindOperationsTx,
    );
  }

  run<T>(work: (tx: OperationsTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
