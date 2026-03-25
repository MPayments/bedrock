import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { SubAgentStore } from "./sub-agent.store";

export interface SubAgentsCommandTx {
  subAgentStore: SubAgentStore;
}

export type SubAgentsCommandUnitOfWork = UnitOfWork<SubAgentsCommandTx>;
