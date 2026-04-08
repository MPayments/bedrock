import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { PartyProfilesStore } from "./party-profiles.store";

export interface PartyProfilesCommandTx {
  partyProfiles: PartyProfilesStore;
}

export type PartyProfilesCommandUnitOfWork = UnitOfWork<PartyProfilesCommandTx>;

