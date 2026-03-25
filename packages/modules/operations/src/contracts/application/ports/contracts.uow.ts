import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { ContractStore } from "./contract.store";

export interface ContractsCommandTx {
  contractStore: ContractStore;
}

export type ContractsCommandUnitOfWork = UnitOfWork<ContractsCommandTx>;
