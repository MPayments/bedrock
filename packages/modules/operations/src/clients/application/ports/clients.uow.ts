import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { ApplicationReads } from "../../../applications/application/ports/application.reads";
import type { ContractStore } from "../../../contracts/application/ports/contract.store";
import type { ClientStore } from "./client.store";

export interface ClientsCommandTx {
  clientStore: ClientStore;
  contractStore: ContractStore;
  applicationReads: Pick<ApplicationReads, "countByClientId">;
}

export type ClientsCommandUnitOfWork = UnitOfWork<ClientsCommandTx>;
