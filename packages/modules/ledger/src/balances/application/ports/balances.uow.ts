import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { BalancesStateRepository } from "../../application/balances/ports";
import type { BalancesIdempotencyPort } from "../../application/shared/external-ports";

export interface BalancesCommandTx {
  idempotency: BalancesIdempotencyPort;
  stateRepository: BalancesStateRepository;
}

export type BalancesCommandUnitOfWork = UnitOfWork<BalancesCommandTx>;
