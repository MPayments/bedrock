import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { CustomerMembershipStore } from "./customer-membership.store";

export interface CustomerMembershipsCommandTx {
  customerMembershipStore: CustomerMembershipStore;
}

export type CustomerMembershipsCommandUnitOfWork = UnitOfWork<
  CustomerMembershipsCommandTx
>;
