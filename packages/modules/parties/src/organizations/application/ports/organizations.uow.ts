import type { LegalEntitiesStore } from "../../../legal-entities/application/ports/legal-entities.store";
import type { OrganizationStore } from "./organization.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface OrganizationsCommandTx {
  legalEntities: LegalEntitiesStore;
  organizationStore: OrganizationStore;
}

export type OrganizationsCommandUnitOfWork = UnitOfWork<OrganizationsCommandTx>;
