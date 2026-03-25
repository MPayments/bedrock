import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { ApplicationStore } from "../../../applications/application/ports/application.store";
import type { DealStore } from "./deal.store";

export interface DealsCommandTx {
  dealStore: DealStore;
  applicationStore: Pick<ApplicationStore, "findById" | "updateStatus">;
}

export type DealsCommandUnitOfWork = UnitOfWork<DealsCommandTx>;
