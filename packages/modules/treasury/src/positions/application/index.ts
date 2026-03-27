import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { SettlePositionCommand } from "./commands/settle-position";
import { ListTreasuryPositionsQuery } from "./queries/list-treasury-positions";

export function createTreasuryPositionsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);
  const settlePosition = new SettlePositionCommand(context);
  const listTreasuryPositions = new ListTreasuryPositionsQuery(context);

  return {
    commands: {
      settlePosition: settlePosition.execute.bind(settlePosition),
    },
    queries: {
      listTreasuryPositions:
        listTreasuryPositions.execute.bind(listTreasuryPositions),
    },
  };
}

export type TreasuryPositionsService = ReturnType<
  typeof createTreasuryPositionsService
>;
