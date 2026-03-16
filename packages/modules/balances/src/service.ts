import { createGetBalanceHandler } from "./application/balances/queries/get-balance";
import { createConsumeBalanceHandler } from "./application/holds/commands/consume-balance";
import { createReleaseBalanceHandler } from "./application/holds/commands/release-balance";
import { createReserveBalanceHandler } from "./application/holds/commands/reserve-balance";
import {
  createBalancesContext,
  type BalancesServiceDeps,
} from "./application/shared/context";
import type {
  BalanceMutationResult,
  BalanceSnapshot,
  BalanceSubjectInput,
  ConsumeBalanceInput,
  ReleaseBalanceInput,
  ReserveBalanceInput,
} from "./contracts";
import { createDrizzleBalancesStateRepository } from "./infra/drizzle/repos/balance-state-repository";

export interface BalancesService {
  getBalance: (subject: BalanceSubjectInput) => Promise<BalanceSnapshot>;
  reserve: (input: ReserveBalanceInput) => Promise<BalanceMutationResult>;
  release: (input: ReleaseBalanceInput) => Promise<BalanceMutationResult>;
  consume: (input: ConsumeBalanceInput) => Promise<BalanceMutationResult>;
}

export function createBalancesService(deps: BalancesServiceDeps): BalancesService {
  const context = createBalancesContext({
    db: deps.db,
    idempotency: deps.idempotency,
    logger: deps.logger,
    createStateRepository: createDrizzleBalancesStateRepository,
  });

  return {
    getBalance: createGetBalanceHandler(context),
    reserve: createReserveBalanceHandler(context),
    release: createReleaseBalanceHandler(context),
    consume: createConsumeBalanceHandler(context),
  };
}
