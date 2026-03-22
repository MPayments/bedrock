import type { PeriodRepository } from "./period.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface PeriodsCommandTx {
  periods: PeriodRepository;
}

export type PeriodsCommandUnitOfWork = UnitOfWork<PeriodsCommandTx>;
