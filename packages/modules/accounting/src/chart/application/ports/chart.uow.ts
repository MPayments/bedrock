import type { ChartStore } from "./chart.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface ChartCommandTx {
  chart: ChartStore;
}

export type ChartCommandUnitOfWork = UnitOfWork<ChartCommandTx>;
