import type { OrganizationStore } from "./organization.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface OrganizationsCommandTx {
  organizationStore: OrganizationStore;
}

export type OrganizationsCommandUnitOfWork = UnitOfWork<OrganizationsCommandTx>;
