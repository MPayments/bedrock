import type { SubAgentProfileStore } from "./sub-agent-profile.store";
import type { CounterpartyGroupHierarchyReads } from "../../../counterparties/application/ports/counterparty-group-hierarchy.reads";
import type { CounterpartyRepository } from "../../../counterparties/application/ports/counterparty.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface SubAgentProfilesCommandTx {
  counterparties: Pick<CounterpartyRepository, "findById" | "save">;
  counterpartyGroupHierarchy: CounterpartyGroupHierarchyReads;
  subAgentProfiles: SubAgentProfileStore;
}

export type SubAgentProfilesCommandUnitOfWork =
  UnitOfWork<SubAgentProfilesCommandTx>;
