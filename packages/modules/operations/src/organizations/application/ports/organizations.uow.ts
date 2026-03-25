import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { BankDetailsStore } from "./bank-details.store";
import type { OrganizationStore } from "./organization.store";

export interface OrganizationsCommandTx {
  organizationStore: OrganizationStore;
  bankDetailsStore: BankDetailsStore;
}

export type OrganizationsCommandUnitOfWork =
  UnitOfWork<OrganizationsCommandTx>;
