import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { DealStore } from "./deal.store";

export interface DealsCommandTx {
  dealStore: DealStore;
}

export type DealsCommandUnitOfWork = UnitOfWork<DealsCommandTx>;
