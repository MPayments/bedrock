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

function bindAgreementTx(transaction: Transaction): AgreementsCommandTx {
  return {
    transaction,
    agreementReads: new DrizzleAgreementReads(transaction),
    agreementStore: new DrizzleAgreementStore(transaction),
  };
}

export class DrizzleAgreementsUnitOfWork implements AgreementsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<AgreementsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindAgreementTx,
    );
  }

  run<T>(work: (tx: AgreementsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
