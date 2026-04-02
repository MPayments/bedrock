import { ConsumeBalanceCommand } from "./commands/consume-balance";
import { ReleaseBalanceCommand } from "./commands/release-balance";
import { ReserveBalanceCommand } from "./commands/reserve-balance";
import type { LedgerBalancesReads } from "./ports/balances.reads";
import type { BalancesCommandUnitOfWork } from "./ports/balances.uow";
import { GetBalanceQuery } from "./queries/get-balance";
import { ListOrganizationLiquidityRowsQuery } from "./queries/list-organization-liquidity-rows";
import { ListOrganizationRequisiteLiquidityRowsQuery } from "./queries/list-organization-requisite-liquidity-rows";

export interface BalancesServiceDeps {
  reads: LedgerBalancesReads;
  commandUow: BalancesCommandUnitOfWork;
}

export function createBalancesService(deps: BalancesServiceDeps) {
  const reserve = new ReserveBalanceCommand(deps.commandUow);
  const release = new ReleaseBalanceCommand(deps.commandUow);
  const consume = new ConsumeBalanceCommand(deps.commandUow);
  const getBalance = new GetBalanceQuery(deps.reads);
  const listOrganizationLiquidityRows =
    new ListOrganizationLiquidityRowsQuery(deps.reads);
  const listOrganizationRequisiteLiquidityRows =
    new ListOrganizationRequisiteLiquidityRowsQuery(deps.reads);

  return {
    commands: {
      reserve: reserve.execute.bind(reserve),
      release: release.execute.bind(release),
      consume: consume.execute.bind(consume),
    },
    queries: {
      getBalance: getBalance.execute.bind(getBalance),
      listOrganizationLiquidityRows:
        listOrganizationLiquidityRows.execute.bind(
          listOrganizationLiquidityRows,
        ),
      listOrganizationRequisiteLiquidityRows:
        listOrganizationRequisiteLiquidityRows.execute.bind(
          listOrganizationRequisiteLiquidityRows,
        ),
    },
  };
}

export type BalancesService = ReturnType<typeof createBalancesService>;
