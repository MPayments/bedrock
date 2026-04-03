import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzlePortalAccessGrantStore } from "../../portal-access-grants/adapters/drizzle/portal-access-grant.store";
import type {
  PortalAccessGrantsTransaction,
  PortalAccessGrantsUnitOfWork,
} from "../../portal-access-grants/application/ports/portal-access-grants.uow";

function bindPortalAccessGrantsTx(tx: Transaction): PortalAccessGrantsTransaction {
  return {
    portalAccessGrantStore: new DrizzlePortalAccessGrantStore(tx),
  };
}

export class DrizzlePortalAccessGrantsUnitOfWork
  implements PortalAccessGrantsUnitOfWork
{
  private readonly transactional: TransactionalPort<PortalAccessGrantsTransaction>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindPortalAccessGrantsTx,
    );
  }

  run<T>(work: (tx: PortalAccessGrantsTransaction) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
