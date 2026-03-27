import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { OpenObligationCommand } from "./commands/open-obligation";
import { GetObligationOutstandingQuery } from "./queries/get-obligation-outstanding";

export function createTreasuryObligationsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);

  const openObligation = new OpenObligationCommand(context);
  const getObligationOutstanding = new GetObligationOutstandingQuery(context);

  return {
    commands: {
      openObligation: openObligation.execute.bind(openObligation),
    },
    queries: {
      getObligationOutstanding:
        getObligationOutstanding.execute.bind(getObligationOutstanding),
    },
  };
}

export type TreasuryObligationsService = ReturnType<
  typeof createTreasuryObligationsService
>;
