import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleCustomerMembershipStore } from "../../customer-memberships/adapters/drizzle/customer-membership.store";
import type {
  CustomerMembershipsCommandTx,
  CustomerMembershipsCommandUnitOfWork,
} from "../../customer-memberships/application/ports/customer-memberships.uow";

function bindCustomerMembershipsTx(
  tx: Transaction,
): CustomerMembershipsCommandTx {
  return {
    customerMembershipStore: new DrizzleCustomerMembershipStore(tx),
  };
}

export class DrizzleCustomerMembershipsUnitOfWork
  implements CustomerMembershipsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<CustomerMembershipsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindCustomerMembershipsTx,
    );
  }

  run<T>(work: (tx: CustomerMembershipsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
