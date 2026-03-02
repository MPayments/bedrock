import { createCreateCounterpartyAccountHandler } from "./commands/create-account";
import { createCreateProviderHandler } from "./commands/create-provider";
import { createDeleteCounterpartyAccountHandler } from "./commands/delete-account";
import { createDeleteProviderHandler } from "./commands/delete-provider";
import { createGetCounterpartyAccountHandler } from "./commands/get-account";
import { createGetProviderHandler } from "./commands/get-provider";
import { createListCounterpartyAccountsHandler } from "./commands/list-accounts";
import { createListProvidersHandler } from "./commands/list-providers";
import { createResolveCounterpartyAccountBindingsHandler } from "./commands/resolve-transfer-bindings";
import { createUpdateCounterpartyAccountHandler } from "./commands/update-account";
import { createUpdateProviderHandler } from "./commands/update-provider";
import {
  createCounterpartyAccountsServiceContext,
  type CounterpartyAccountsServiceDeps,
} from "./internal/context";

export type CounterpartyAccountsService = ReturnType<
  typeof createCounterpartyAccountsService
>;

export function createCounterpartyAccountsService(
  deps: CounterpartyAccountsServiceDeps,
) {
  const context = createCounterpartyAccountsServiceContext(deps);

  const createProvider = createCreateProviderHandler(context);
  const getProvider = createGetProviderHandler(context);
  const updateProvider = createUpdateProviderHandler(context);
  const deleteProvider = createDeleteProviderHandler(context);
  const listProviders = createListProvidersHandler(context);

  const createAccount = createCreateCounterpartyAccountHandler(context);
  const getAccount = createGetCounterpartyAccountHandler(context);
  const updateAccount = createUpdateCounterpartyAccountHandler(context);
  const deleteAccount = createDeleteCounterpartyAccountHandler(context);
  const listAccounts = createListCounterpartyAccountsHandler(context);
  const resolveTransferBindings =
    createResolveCounterpartyAccountBindingsHandler(context);

  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listProviders,

    createAccount,
    getAccount,
    updateAccount,
    deleteAccount,
    listAccounts,
    resolveTransferBindings,
  };
}
