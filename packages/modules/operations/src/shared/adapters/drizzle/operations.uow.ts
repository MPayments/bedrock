import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleApplicationReads } from "../../../applications/adapters/drizzle/application.reads";
import { DrizzleApplicationStore } from "../../../applications/adapters/drizzle/application.store";
import type {
  ApplicationsCommandTx,
  ApplicationsCommandUnitOfWork,
} from "../../../applications/application/ports/applications.uow";
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

type OperationsTx = ApplicationsCommandTx &
  DealsCommandTx &
  ClientsCommandTx;

function bindOperationsTx(tx: Transaction): OperationsTx {
  const applicationStore = new DrizzleApplicationStore(tx);
  const applicationReads = new DrizzleApplicationReads(tx);
  const todoStore = new DrizzleTodoStore(tx);

  return {
    applicationStore,
    dealStore: new DrizzleDealStore(tx),
    clientStore: new DrizzleClientStore(tx),
    customerBridge: new DrizzleCustomerBridge(tx),
    applicationReads,
    todoStore,
  };
}

export class DrizzleOperationsUnitOfWork
  implements
    ApplicationsCommandUnitOfWork,
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
