import { UpsertCustomerMembershipCommand } from "./commands/upsert-customer-membership";
import type { CustomerMembershipReads } from "./ports/customer-membership.reads";
import type { CustomerMembershipsCommandUnitOfWork } from "./ports/customer-memberships.uow";
import { HasCustomerMembershipQuery } from "./queries/has-customer-membership";
import { ListCustomerMembershipsByUserIdQuery } from "./queries/list-customer-memberships-by-user-id";

export interface CustomerMembershipsServiceDeps {
  commandUow: CustomerMembershipsCommandUnitOfWork;
  reads: CustomerMembershipReads;
}

export function createCustomerMembershipsService(
  deps: CustomerMembershipsServiceDeps,
) {
  const upsertCustomerMembership = new UpsertCustomerMembershipCommand(
    deps.commandUow,
  );
  const listCustomerMembershipsByUserId =
    new ListCustomerMembershipsByUserIdQuery(deps.reads);
  const hasCustomerMembership = new HasCustomerMembershipQuery(deps.reads);

  return {
    commands: {
      upsert: upsertCustomerMembership.execute.bind(upsertCustomerMembership),
    },
    queries: {
      hasMembership: hasCustomerMembership.execute.bind(hasCustomerMembership),
      listByUserId: listCustomerMembershipsByUserId.execute.bind(
        listCustomerMembershipsByUserId,
      ),
    },
  };
}

export type CustomerMembershipsService = ReturnType<
  typeof createCustomerMembershipsService
>;
