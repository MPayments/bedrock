import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { ApplicationReads } from "../../../applications/application/ports/application.reads";
import type { ClientStore } from "./client.store";
import type { CustomerBridgePort } from "./customer-bridge.port";

export interface ClientsCommandTx {
  clientStore: ClientStore;
  customerBridge: CustomerBridgePort;
  applicationReads: Pick<ApplicationReads, "countByClientId">;
}

export type ClientsCommandUnitOfWork = UnitOfWork<ClientsCommandTx>;
