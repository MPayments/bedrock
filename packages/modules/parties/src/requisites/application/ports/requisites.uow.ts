import type { RequisiteBindingStore } from "./requisite-binding.store";
import type { RequisiteProviderStore } from "./requisite-provider.store";
import type { RequisiteRepository } from "./requisite.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface RequisitesCommandTx {
  requisiteBindingStore: Pick<RequisiteBindingStore, "upsert">;
  requisiteProviderStore: RequisiteProviderStore;
  requisites: RequisiteRepository;
}

export type RequisitesCommandUnitOfWork = UnitOfWork<RequisitesCommandTx>;
