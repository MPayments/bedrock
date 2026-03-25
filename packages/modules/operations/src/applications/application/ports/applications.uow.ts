import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { ApplicationStore } from "./application.store";

export interface ApplicationsCommandTx {
  applicationStore: ApplicationStore;
}

export type ApplicationsCommandUnitOfWork =
  UnitOfWork<ApplicationsCommandTx>;
