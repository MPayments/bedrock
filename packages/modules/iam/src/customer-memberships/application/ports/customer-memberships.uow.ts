import type { CustomerMembershipStore } from "./customer-membership.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface CustomerMembershipsCommandTx {
  customerMembershipStore: CustomerMembershipStore;
}

export type CustomerMembershipsCommandUnitOfWork = UnitOfWork<
  CustomerMembershipsCommandTx
>;
