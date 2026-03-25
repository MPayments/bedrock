import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { CalculationStore } from "./calculation.store";

export interface CalculationsCommandTx {
  calculationStore: CalculationStore;
}

export type CalculationsCommandUnitOfWork =
  UnitOfWork<CalculationsCommandTx>;
