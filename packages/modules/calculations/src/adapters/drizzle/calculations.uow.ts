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

function bindCalculationsTx(transaction: Transaction): CalculationsCommandTx {
  return {
    transaction,
    calculationReads: new DrizzleCalculationReads(transaction),
    calculationStore: new DrizzleCalculationStore(transaction),
  };
}

export class DrizzleCalculationsUnitOfWork
  implements CalculationsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<CalculationsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindCalculationsTx,
    );
  }

  run<T>(work: (tx: CalculationsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
