import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { CreateCounterpartyEndpointCommand } from "./commands/create-counterparty-endpoint";
import { CreateTreasuryAccountCommand } from "./commands/create-treasury-account";
import { CreateTreasuryEndpointCommand } from "./commands/create-treasury-endpoint";
import { GetTreasuryAccountBalancesQuery } from "./queries/get-treasury-account-balances";
import { ListCounterpartyEndpointsQuery } from "./queries/list-counterparty-endpoints";
import { ListTreasuryAccountsQuery } from "./queries/list-treasury-accounts";
import { ListTreasuryEndpointsQuery } from "./queries/list-treasury-endpoints";

export function createTreasuryAccountsService(deps: TreasuryCoreServiceDeps) {
  const context = createTreasuryCoreServiceContext(deps);

  const createCounterpartyEndpoint = new CreateCounterpartyEndpointCommand(
    context,
  );
  const createTreasuryAccount = new CreateTreasuryAccountCommand(context);
  const createTreasuryEndpoint = new CreateTreasuryEndpointCommand(context);
  const getTreasuryAccountBalances = new GetTreasuryAccountBalancesQuery(
    context,
  );
  const listCounterpartyEndpoints = new ListCounterpartyEndpointsQuery(context);
  const listTreasuryAccounts = new ListTreasuryAccountsQuery(context);
  const listTreasuryEndpoints = new ListTreasuryEndpointsQuery(context);

  return {
    commands: {
      createCounterpartyEndpoint:
        createCounterpartyEndpoint.execute.bind(createCounterpartyEndpoint),
      createTreasuryAccount:
        createTreasuryAccount.execute.bind(createTreasuryAccount),
      createTreasuryEndpoint:
        createTreasuryEndpoint.execute.bind(createTreasuryEndpoint),
    },
    queries: {
      getTreasuryAccountBalances:
        getTreasuryAccountBalances.execute.bind(getTreasuryAccountBalances),
      listCounterpartyEndpoints:
        listCounterpartyEndpoints.execute.bind(listCounterpartyEndpoints),
      listTreasuryAccounts:
        listTreasuryAccounts.execute.bind(listTreasuryAccounts),
      listTreasuryEndpoints:
        listTreasuryEndpoints.execute.bind(listTreasuryEndpoints),
    },
  };
}

export type TreasuryAccountsService = ReturnType<
  typeof createTreasuryAccountsService
>;
