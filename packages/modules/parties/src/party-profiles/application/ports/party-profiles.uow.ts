import type { PartyProfilesStore } from "./party-profiles.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface PartyProfilesCommandTx {
  partyProfiles: PartyProfilesStore;
}

export type PartyProfilesCommandUnitOfWork = UnitOfWork<PartyProfilesCommandTx>;

