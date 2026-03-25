import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import type {
  OrganizationsCommandTx,
  OrganizationsCommandUnitOfWork,
} from "../../application/ports/organizations.uow";
import { DrizzleBankDetailsStore } from "./bank-details.store";
import { DrizzleOrganizationStore } from "./organization.store";

function bindOrganizationsTx(tx: Transaction): OrganizationsCommandTx {
  return {
    organizationStore: new DrizzleOrganizationStore(tx),
    bankDetailsStore: new DrizzleBankDetailsStore(tx),
  };
}

export class DrizzleOrganizationsUnitOfWork
  implements OrganizationsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<OrganizationsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindOrganizationsTx,
    );
  }

  run<T>(work: (tx: OrganizationsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
