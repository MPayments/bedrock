import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { LegalEntitiesStore } from "./legal-entities.store";

export interface LegalEntitiesCommandTx {
  legalEntities: LegalEntitiesStore;
}

export type LegalEntitiesCommandUnitOfWork = UnitOfWork<LegalEntitiesCommandTx>;

