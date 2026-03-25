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
import { DrizzleCalculationStore } from "../../../calculations/adapters/drizzle/calculation.store";
import type {
  CalculationsCommandTx,
  CalculationsCommandUnitOfWork,
} from "../../../calculations/application/ports/calculations.uow";
import { DrizzleClientStore } from "../../../clients/adapters/drizzle/client.store";
import type {
  ClientsCommandTx,
  ClientsCommandUnitOfWork,
} from "../../../clients/application/ports/clients.uow";
import { DrizzleContractStore } from "../../../contracts/adapters/drizzle/contract.store";
import type {
  ContractsCommandTx,
  ContractsCommandUnitOfWork,
} from "../../../contracts/application/ports/contracts.uow";
import { DrizzleDealStore } from "../../../deals/adapters/drizzle/deal.store";
import type {
  DealsCommandTx,
  DealsCommandUnitOfWork,
} from "../../../deals/application/ports/deals.uow";

type OperationsTx = ContractsCommandTx &
  ApplicationsCommandTx &
  CalculationsCommandTx &
  DealsCommandTx &
  ClientsCommandTx;

function bindOperationsTx(tx: Transaction): OperationsTx {
  const applicationStore = new DrizzleApplicationStore(tx);
  const applicationReads = new DrizzleApplicationReads(tx);

  return {
    contractStore: new DrizzleContractStore(tx),
    applicationStore,
    calculationStore: new DrizzleCalculationStore(tx),
    dealStore: new DrizzleDealStore(tx),
    clientStore: new DrizzleClientStore(tx),
    applicationReads,
  };
}

export class DrizzleOperationsUnitOfWork
  implements
    ContractsCommandUnitOfWork,
    ApplicationsCommandUnitOfWork,
    CalculationsCommandUnitOfWork,
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
