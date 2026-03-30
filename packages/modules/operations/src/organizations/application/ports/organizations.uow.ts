import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { OrganizationStore } from "./organization.store";

export interface OrganizationsCommandTx {
  organizationStore: OrganizationStore;
}

export type OrganizationsCommandUnitOfWork =
  UnitOfWork<OrganizationsCommandTx>;
