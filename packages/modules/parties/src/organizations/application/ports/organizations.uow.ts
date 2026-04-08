import type { PartyProfilesStore } from "../../../party-profiles/application/ports/party-profiles.store";
import type { OrganizationStore } from "./organization.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface OrganizationsCommandTx {
  partyProfiles: PartyProfilesStore;
  organizationStore: OrganizationStore;
}

export type OrganizationsCommandUnitOfWork = UnitOfWork<OrganizationsCommandTx>;
